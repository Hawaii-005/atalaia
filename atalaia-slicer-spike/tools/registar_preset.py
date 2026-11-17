#!/usr/bin/env python3
"""Regista um preset de impressora na árvore de sistema e torna-o compatível.

Uso:
    python3 tools/registar_preset.py "Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC"
    python3 tools/registar_preset.py ... --check     # só verifica; exit 1 se faltar algo

O preset tem de existir em assets/profiles/<Fornecedor>/machine/<Serie>/<nome>.json com
`inherits` a apontar para a impressora base. O script:
  1. acrescenta {name, sub_path} a machine_list no índice <Fornecedor>.json (se faltar);
  2. acrescenta o nome a compatible_printers de todo o filamento/processo da mesma série
     onde a impressora base consta.
Edita só o texto do array (uma linha por ficheiro); o resto fica byte a byte.
Idempotente: correr duas vezes não duplica nem reescreve ficheiros já certos.
"""
import json
import sys
from pathlib import Path

PROFILES = Path(__file__).resolve().parents[1] / "app/src/main/assets/profiles"


def array_span(text, key):
    """Devolve (i, j) dos '[' e ']' do array do campo `key`, ou None."""
    k = text.find(f'"{key}"')
    if k < 0:
        return None
    start = text.find("[", k)
    if start < 0:
        return None
    depth, in_str, esc = 0, False, False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return start, i
    return None


def append_to_array(text, key, value_text):
    """Insere value_text no fim do array `key` mantendo o estilo; None se já lá está."""
    span = array_span(text, key)
    if not span:
        return None
    start, end = span
    body = text[start + 1:end]
    if value_text in body:
        return None
    if "\n" in body:
        stripped = body.rstrip()
        line_start = stripped.rfind("\n") + 1
        indent = stripped[line_start:len(stripped) - len(stripped[line_start:].lstrip())]
        cut = start + 1 + len(stripped)
        insert = "" if stripped.strip() == "" else f",\n{indent}{value_text}"
        return text[:cut] + insert + text[cut:]
    insert = f", {value_text}" if body.strip() else value_text
    return text[:end] + insert + text[end:]


def main(argv):
    check = "--check" in argv
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    name = args[0]

    hits = list(PROFILES.glob(f"*/machine/*/{name}.json"))
    if len(hits) != 1:
        sys.exit(f"preset '{name}': {len(hits)} ficheiros encontrados (esperava 1)")
    preset_path = hits[0]
    vendor_dir = preset_path.parents[2]           # <Fornecedor>
    series_dir = preset_path.parent                # machine/<Serie>
    index_path = vendor_dir.with_suffix(".json")

    preset = json.loads(preset_path.read_text(encoding="utf-8"))
    base = preset.get("inherits")
    if not base:
        sys.exit(f"preset '{name}' não tem 'inherits' — sem impressora base não há compatibilidade")
    rel = preset_path.relative_to(vendor_dir).as_posix()

    # 1. machine_list
    index_before = index_path.read_text(encoding="utf-8")
    index_missing = not any(m.get("name") == name
                            for m in json.loads(index_before).get("machine_list", []))
    if index_missing:
        entry = json.dumps({"name": name, "sub_path": rel}, ensure_ascii=False)
        index_after = append_to_array(index_before, "machine_list", entry)
        if index_after is None:
            sys.exit("índice sem machine_list — não sei onde registar")
        if not check:
            index_path.write_text(index_after, encoding="utf-8")
        print(f"{'falta' if check else 'index'}  machine_list += {name}")
    else:
        print(f"ok     machine_list já tem {name}")

    # 2. compatibilidade na mesma série
    dirty = 0
    for kind in ("filament", "process"):
        for f in sorted((vendor_dir / kind / series_dir.name).glob("*.json")):
            before = f.read_text(encoding="utf-8")
            cp = json.loads(before).get("compatible_printers")
            if not isinstance(cp, list) or base not in cp or name in cp:
                continue
            dirty += 1
            after = append_to_array(before, "compatible_printers", json.dumps(name, ensure_ascii=False))
            if after is not None and not check:
                f.write_text(after, encoding="utf-8")
    print(f"{'faltam' if check else 'editei'} {dirty} JSON de filamento/processo")

    return 1 if check and (index_missing or dirty) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""Regista um preset de impressora na árvore de sistema e torna-o compatível.

Uso:
    python3 tools/registar_preset.py "Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC"
    python3 tools/registar_preset.py ... --check     # só verifica, não escreve

O preset tem de existir em assets/profiles/<Fornecedor>/machine/<Serie>/<nome>.json com
`inherits` a apontar para a impressora base. O script:
  1. acrescenta {name, sub_path} a machine_list no índice <Fornecedor>.json (se faltar);
  2. acrescenta o nome a compatible_printers de todo o filamento/processo da mesma série
     onde a impressora base consta.
Idempotente: correr duas vezes não duplica nem reescreve ficheiros já certos.
"""
import json
import sys
from pathlib import Path

PROFILES = Path(__file__).resolve().parents[1] / "app/src/main/assets/profiles"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path, data, before):
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if text != before:
        path.write_text(text, encoding="utf-8")
        return True
    return False


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

    preset = load(preset_path)
    base = preset.get("inherits")
    if not base:
        sys.exit(f"preset '{name}' não tem 'inherits' — sem impressora base não há compatibilidade")
    rel = preset_path.relative_to(vendor_dir).as_posix()

    # 1. machine_list
    idx_before = index_path.read_text(encoding="utf-8")
    index = json.loads(idx_before)
    ml = index.setdefault("machine_list", [])
    if not any(m.get("name") == name for m in ml):
        ml.append({"name": name, "sub_path": rel})
        changed_index = not check and save(index_path, index, idx_before)
        print(f"{'falta' if check else 'index'}  machine_list += {name}")
    else:
        changed_index = False
        print(f"ok     machine_list já tem {name}")

    # 2. compatibilidade na mesma série
    dirty = 0
    for kind in ("filament", "process"):
        for f in sorted((vendor_dir / kind / series_dir.name).glob("*.json")):
            before = f.read_text(encoding="utf-8")
            data = json.loads(before)
            cp = data.get("compatible_printers")
            if not isinstance(cp, list) or base not in cp or name in cp:
                continue
            cp.append(name)
            dirty += 1
            if not check:
                save(f, data, before)
    print(f"{'faltam' if check else 'editei'} {dirty} JSON de filamento/processo")

    missing = changed_index or dirty
    if check and missing:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

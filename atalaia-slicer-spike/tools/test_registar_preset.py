#!/usr/bin/env python3
"""Teste de regressão do registar_preset.py. Correr: python3 tools/test_registar_preset.py"""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SCRIPT = REPO / "tools/registar_preset.py"
PROFILES = REPO / "app/src/main/assets/profiles"
NOME = "Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC"


class RegistoPreset(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        shutil.copytree(PROFILES, self.tmp / "app/src/main/assets/profiles")
        (self.tmp / "tools").mkdir()
        shutil.copy(SCRIPT, self.tmp / "tools")
        self.idx = self.tmp / "app/src/main/assets/profiles/Elegoo.json"
        self.fil = self.tmp / "app/src/main/assets/profiles/Elegoo/filament/ECC/Elegoo PLA @ECC.json"

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_script(self, check=False):
        cmd = [sys.executable, str(self.tmp / "tools/registar_preset.py"), NOME]
        if check:
            cmd.append("--check")
        return subprocess.run(cmd, capture_output=True, text=True).returncode

    def sem_indice(self):
        d = json.loads(self.idx.read_text())
        d["machine_list"] = [m for m in d["machine_list"] if m.get("name") != NOME]
        self.idx.write_text(json.dumps(d, indent=4, ensure_ascii=False))

    def sem_filamento(self):
        d = json.loads(self.fil.read_text())
        d["compatible_printers"] = [x for x in d["compatible_printers"] if x != NOME]
        self.fil.write_text(json.dumps(d, indent=4, ensure_ascii=False))

    def test_caso_a_so_falta_indice(self):
        self.sem_indice()
        self.assertEqual(self.run_script(check=True), 1)
        self.assertEqual(self.run_script(), 0)
        nomes = [m["name"] for m in json.loads(self.idx.read_text())["machine_list"]]
        self.assertEqual(nomes.count(NOME), 1)

    def test_caso_b_indice_e_filamento(self):
        self.sem_indice()
        self.sem_filamento()
        self.assertEqual(self.run_script(check=True), 1)
        self.assertEqual(self.run_script(), 0)
        self.assertIn(NOME, json.loads(self.fil.read_text())["compatible_printers"])

    def test_caso_c_idempotente(self):
        self.assertEqual(self.run_script(check=True), 0)
        antes = self.idx.read_bytes(), self.fil.read_bytes()
        self.assertEqual(self.run_script(), 0)
        self.assertEqual((self.idx.read_bytes(), self.fil.read_bytes()), antes)


if __name__ == "__main__":
    unittest.main(verbosity=2)

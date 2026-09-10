#!/usr/bin/env python3
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PORT = 8765
BASE_URL = f"http://127.0.0.1:{PORT}/index.html"


def wait_server(url: str, timeout_s: float = 20.0) -> None:
    started = time.time()
    last_err = None
    while (time.time() - started) < timeout_s:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return
        except Exception as err:  # noqa: BLE001
            last_err = err
            time.sleep(0.25)
    raise RuntimeError(f"Server did not start in time: {last_err}")


def run_browser_checks() -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as err:  # noqa: BLE001
        raise RuntimeError(
            "Playwright for Python is required. Install with: pip install playwright && python -m playwright install chromium"
        ) from err

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(BASE_URL, wait_until="load", timeout=120000)
        page.wait_for_function("() => typeof window.cutCSV === 'function' && !!window.trailerApp", timeout=120000)

        result = page.evaluate(
            """
            async () => {
              function parseCsvLine(line, sep) { return line.split(sep); }
              const originalFetch = window.fetch.bind(window);
              window.fetch = async (url, opts) => {
                try {
                  const body = JSON.parse((opts && opts.body) || '{}');
                  const prompt = String(body && body.prompt || '');
                  if (prompt.includes('"ordered_ids"')) {
                    return { ok: true, status: 200, json: async () => ({ response: '{"ordered_ids":[]}' }) };
                  }
                  if (prompt.includes('"materials"') || prompt.includes('Escolha o melhor material')) {
                    return { ok: true, status: 200, json: async () => ({ response: '{"materials":{}}' }) };
                  }
                } catch (e) {}
                return originalFetch(url, opts);
              };

              window.cutOpenModal();
              const holesToggle = document.getElementById('cut-include-holes');
              if (holesToggle) {
                holesToggle.checked = true;
                holesToggle.dispatchEvent(new Event('change'));
              }

              const csv = await window.cutCSV(false);
              const csvLeroy = await window.cutCSV(true);
              const jsonText = await window.cutJSON();
              const excelHtml = await window.cutExcelHtmlTable();

              const jsonObj = JSON.parse(jsonText);
              const lines = csv.trim().split('\\n');
              const header = lines[0];
              const rows = lines.slice(1).map((l) => parseCsvLine(l, ','));
              const pecaRows = rows.filter((r) => (r[9] || '') === 'peca');
              const invalidPecaSize = pecaRows.filter((r) => Number(r[2]) > 2170 || Number(r[3]) > 1070);

              if (holesToggle) {
                holesToggle.checked = false;
                holesToggle.dispatchEvent(new Event('change'));
              }
              const jsonNoHolesText = await window.cutJSON();
              const jsonNoHoles = JSON.parse(jsonNoHolesText);

              return {
                csvHeader: header,
                csvRows: rows.length,
                csvHasTipoRegistro: header.includes('Tipo_Registro'),
                csvHasParte: header.includes('Parte'),
                csvHasHoleRows: rows.some((r) => (r[9] || '') === 'furo'),
                invalidPecaSizeCount: invalidPecaSize.length,
                leroyHeader: (csvLeroy.trim().split('\\n')[0] || ''),
                jsonHasEnvelope: !!(jsonObj && jsonObj.pecas && jsonObj.chapa_util_mm),
                jsonIncludeFurosTrue: jsonObj && jsonObj.include_furos === true,
                jsonFurosCount: Array.isArray(jsonObj.furos) ? jsonObj.furos.length : -1,
                jsonOpsCount: Array.isArray(jsonObj.operacoes_usinagem) ? jsonObj.operacoes_usinagem.length : -1,
                jsonIncludeFurosFalse: jsonNoHoles && jsonNoHoles.include_furos === false,
                jsonNoHolesCount: Array.isArray(jsonNoHoles.furos) ? jsonNoHoles.furos.length : -1,
                excelHasTipoRegistroCol: excelHtml.includes('<th>Tipo Registro</th>'),
                excelHasGrupoOrigemCol: excelHtml.includes('<th>Grupo Origem</th>'),
                excelHasParteCol: excelHtml.includes('<th>Parte</th>'),
                excelHasFuroRow: excelHtml.includes('furo janela') || excelHtml.includes('furo porta') || excelHtml.includes('furo outro'),
              };
            }
            """
        )
        browser.close()
        return result


def validate_result(result: dict) -> list[str]:
    failures = []
    if not result.get("csvHasTipoRegistro"):
        failures.append("CSV missing Tipo_Registro header")
    if not result.get("csvHasParte"):
        failures.append("CSV missing Parte header")
    if not result.get("csvHasHoleRows"):
        failures.append("CSV missing hole rows when enabled")
    if int(result.get("invalidPecaSizeCount", 0)) > 0:
        failures.append("Found peca rows larger than 2170x1070")
    if not result.get("jsonHasEnvelope"):
        failures.append("JSON envelope missing")
    if not result.get("jsonIncludeFurosTrue"):
        failures.append("JSON include_furos=true missing")
    if int(result.get("jsonFurosCount", 0)) <= 0:
        failures.append("JSON furos empty when enabled")
    if int(result.get("jsonOpsCount", 0)) <= 0:
        failures.append("JSON operacoes_usinagem empty when enabled")
    if not result.get("jsonIncludeFurosFalse"):
        failures.append("JSON include_furos=false missing when disabled")
    if int(result.get("jsonNoHolesCount", -1)) != 0:
        failures.append("JSON furos should be empty when disabled")
    if not (result.get("excelHasTipoRegistroCol") and result.get("excelHasGrupoOrigemCol") and result.get("excelHasParteCol")):
        failures.append("Excel columns incomplete")
    if not result.get("excelHasFuroRow"):
        failures.append("Excel missing furo rows")
    return failures


def main() -> int:
    server = subprocess.Popen(
        [sys.executable, "serve.py", str(PORT)],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_server(BASE_URL)
        result = run_browser_checks()
        failures = validate_result(result)
        print(json.dumps({"result": result, "failures": failures}, ensure_ascii=True, indent=2))
        return 1 if failures else 0
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except Exception:  # noqa: BLE001
            server.kill()


if __name__ == "__main__":
    raise SystemExit(main())

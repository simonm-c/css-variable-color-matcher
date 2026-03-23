import { parseCssCustomProperties } from "../cssParser/index.js";
import type { ColorVariable } from "../cssParser/index.js";

export function exportListAsCss(listName: string, vars: ColorVariable[]): void {
  const lines = vars.map((v) => `  ${v.name}: ${v.value};`);
  const css = `:root {\n${lines.join("\n")}\n}\n`;

  const blob = new Blob([css], { type: "text/css" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${listName.replace(/[^a-zA-Z0-9 _-]/g, "_")}.css`;
  a.click();

  URL.revokeObjectURL(url);
}

export function triggerCssFileImport(
  onLoaded: (filename: string, vars: ColorVariable[]) => void,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".css,text/css";
  input.style.display = "none";

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const vars = parseCssCustomProperties(text);
      const name = file.name.replace(/\.css$/i, "");
      onLoaded(name, vars);
    };
    reader.readAsText(file);

    input.remove();
  });

  document.body.appendChild(input);
  input.click();
}

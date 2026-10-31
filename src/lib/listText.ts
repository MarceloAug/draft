export function buildListText(title: string, names: string[], url: string): string {
  const lines = names.map((name, i) => `${i + 1}. ${name}`);
  return [`🏐 ${title}`, ...lines, "", `Confirme aqui: ${url}`].join("\n");
}

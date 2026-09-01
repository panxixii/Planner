export interface NodeColorScheme {
  accent: string;
  surface: string;
  border: string;
}

const NODE_COLOR_SCHEMES: Record<string, NodeColorScheme> = {
  emerald: { accent: '#67c8bd', surface: '#f0fbf8', border: '#b9e5df' },
  rose: { accent: '#d78fb5', surface: '#fff5fa', border: '#efc9dc' },
  sky: { accent: '#79bfd5', surface: '#f2fbfd', border: '#bedfe8' },
  amber: { accent: '#d9b958', surface: '#fffbed', border: '#eadb9f' },
  violet: { accent: '#9b8ae4', surface: '#f8f5ff', border: '#d6ccf1' },
  indigo: { accent: '#9387d1', surface: '#f6f5fc', border: '#d1cbea' },
};

const mixHexWithWhite = (color: string, colorRatio: number) => {
  const channels = color.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16));
  if (!channels || channels.length !== 3) return '#f6f5fc';
  return `#${channels.map((channel) => Math.round(255 - (255 - channel) * colorRatio).toString(16).padStart(2, '0')).join('')}`;
};

export const getNodeColorScheme = (color?: string): NodeColorScheme => {
  const selectedColor = color || 'indigo';
  if (NODE_COLOR_SCHEMES[selectedColor]) return NODE_COLOR_SCHEMES[selectedColor];
  if (/^#[0-9a-f]{6}$/i.test(selectedColor)) {
    return {
      accent: selectedColor,
      surface: mixHexWithWhite(selectedColor, 0.08),
      border: mixHexWithWhite(selectedColor, 0.34),
    };
  }
  return NODE_COLOR_SCHEMES.indigo;
};

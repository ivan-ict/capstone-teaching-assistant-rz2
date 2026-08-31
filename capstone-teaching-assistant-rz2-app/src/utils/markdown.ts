interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  position?: unknown;
}

const HTML_BREAK_PATTERN = /^<br\s*\/?>$/i;

export const remarkHtmlBreaks = () => (tree: MarkdownNode) => {
  const replaceHtmlBreaks = (node: MarkdownNode) => {
    if (!node.children) return;

    node.children = node.children.map(child => {
      if (child.type === 'html' && HTML_BREAK_PATTERN.test(child.value || '')) {
        return { type: 'break', position: child.position };
      }
      replaceHtmlBreaks(child);
      return child;
    });
  };

  replaceHtmlBreaks(tree);
};

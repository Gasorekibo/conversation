export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce that all function names start with a lowercase letter',
    },
    schema: [],
    messages: {
      lowerCaseRequired:
        "Function '{{name}}' must start with a lowercase letter.",
    },
  },

  create(context) {
    return {
      FunctionDeclaration(node) {
        if (node.id?.name && /^[A-Z]/.test(node.id.name)) {
          context.report({
            node: node.id,
            messageId: 'lowerCaseRequired',
            data: { name: node.id.name },
          });
        }
      },

      VariableDeclarator(node) {
        if (
          node.id?.type === 'Identifier' &&
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' ||
            node.init.type === 'FunctionExpression') &&
          /^[A-Z]/.test(node.id.name)
        ) {
          context.report({
            node: node.id,
            messageId: 'lowerCaseRequired',
            data: { name: node.id.name },
          });
        }
      },
    };
  },
};

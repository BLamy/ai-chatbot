export const WORK_DIR_NAME = 'webcontainer-rl';
export const DEFAULT_NODE_MODULES = {
  'package.json': {
    file: {
      contents: JSON.stringify(
        {
          name: 'webcontainer-rl-playground',
          type: 'module',
          dependencies: {},
        },
        null,
        2
      ),
    },
  },
  'tsconfig.json': {
    file: {
      contents: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            module: "CommonJS",
            moduleResolution: "node",
            esModuleInterop: true,
            strict: false, // Allow more flexible code
            skipLibCheck: true,
            allowJs: true,
            isolatedModules: true,
            noImplicitAny: false,
          },
        },
        null,
        2
      ),
    },
  },
  'node_modules': {
    directory: {},
  },
};
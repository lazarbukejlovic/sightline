// Ambient declaration for global stylesheet side-effect imports
// (e.g. `import "./globals.css"`), which TS does not resolve on its own
// under `module: esnext` / strict side-effect import checking.
declare module "*.css";

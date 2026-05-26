const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve symbol-link / parent-folder imports for shared types
// from the Next.js project (../src). We don't import runtime code from web —
// only types and pure constants live in shared modules.
config.watchFolders = [require("path").resolve(__dirname, "..", "src")];

module.exports = withNativeWind(config, { input: "./global.css" });

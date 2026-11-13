// Sentry's Expo config is Expo's default plus debug IDs on bundles and source
// maps, so crash reports can be matched to the code that produced them.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);

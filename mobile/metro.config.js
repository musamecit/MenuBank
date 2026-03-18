const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// inlineRequires kapatıldı - Hermes crash riski nedeniyle

module.exports = config;

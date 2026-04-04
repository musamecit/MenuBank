/**
 * Fixes frequent "PhaseScriptExecution failed with a nonzero exit code" on Xcode 15+:
 * 1) ENABLE_USER_SCRIPT_SANDBOXING — RN / CocoaPods scripts (e.g. RNGoogleMobileAds PlistBuddy)
 *    need to read/write build products; sandbox blocks those writes.
 * 2) [Expo] Configure project — replace `bash -l -c` with a plain bash invocation so GUI Xcode
 *    does not depend on a login shell (nvm/profile) when NODE_BINARY is already in .xcode.env.local.
 */
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function setSandboxOff(project) {
  project.updateBuildProperty('ENABLE_USER_SCRIPT_SANDBOXING', 'NO');
}

function patchPbxprojContents(contents) {
  const oldSnippet =
    'bash -l -c \\"./Pods/Target\\\\ Support\\\\ Files/Pods-MenuBank/expo-configure-project.sh\\"\\n';
  const newSnippet =
    'cd \\"${SRCROOT}\\"\\n/bin/bash \\"./Pods/Target Support Files/Pods-MenuBank/expo-configure-project.sh\\"\\n';
  if (contents.includes('bash -l -c') && contents.includes('expo-configure-project.sh')) {
    contents = contents.replace(oldSnippet, newSnippet);
  }
  return contents;
}

function withIosBuildScriptRobustness(config) {
  config = withXcodeProject(config, (cfg) => {
    setSandboxOff(cfg.modResults);
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const entries = fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : [];
      const matches = entries
        .filter((d) => d.isDirectory() && d.name.endsWith('.xcodeproj'))
        .map((d) => path.join(root, d.name, 'project.pbxproj'))
        .filter((p) => fs.existsSync(p));
      for (const pbxPath of matches) {
        let contents = fs.readFileSync(pbxPath, 'utf8');
        const next = patchPbxprojContents(contents);
        if (next !== contents) {
          fs.writeFileSync(pbxPath, next);
        }
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withIosBuildScriptRobustness;

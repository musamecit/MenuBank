/**
 * Expo config plugin: Podfile post_install patches (survives `expo prebuild --clean`).
 *
 * 1) fmt 11.0.2 + Xcode 16+: base.h overrides FMT_USE_CONSTEVAL via __cpp_consteval — replace detection block in Pods.
 * 2) Pods with IPHONEOS_DEPLOYMENT_TARGET < 12 → bump to 12.0
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# [menubank] post_install fixes v3';

const RUBY_SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        tv = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if tv && tv.to_f < 12.0
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '12.0'
        end
      end
    end
    fmt_base = File.join(__dir__, 'Pods/fmt/include/fmt/base.h')
    if File.exist?(fmt_base)
      c = File.read(fmt_base)
      c_healed = c.sub(/^\\[menubank\\] fmt consteval xcode workaround$/m, '// [menubank] fmt consteval xcode workaround')
      if c_healed != c
        system('chmod', 'u+w', fmt_base)
        File.write(fmt_base, c_healed)
        c = c_healed
      end
      m = '// [menubank] fmt consteval xcode workaround'
      unless c.include?(m)
        start_m = '// Detect consteval, C++20 constexpr extensions and std::is_constant_evaluated.'
        end_m = '#if defined(FMT_USE_NONTYPE_TEMPLATE_ARGS)'
        i = c.index(start_m)
        j = c.index(end_m)
        if i && j && j > i
          rep = m + "\\n" + '#define FMT_USE_CONSTEVAL 0' + "\\n" + '#define FMT_CONSTEVAL' + "\\n" + '#define FMT_CONSTEXPR20' + "\\n"
          system('chmod', 'u+w', fmt_base)
          File.write(fmt_base, c[0...i] + rep + c[j..])
        else
          Pod::UI.warn '[menubank] fmt base.h patch failed (markers not found)'
        end
      end
    end
`;

function stripOldMenubankBlocks(contents) {
  return contents.replace(
    /\n    # \[menubank\] post_install fixes[^\n]*\n(?:    .+\n)*?(?=\n  end\n)/g,
    '\n',
  );
}

function withIosPodfilePostInstallFixes(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) {
        return cfg;
      }

      contents = stripOldMenubankBlocks(contents);

      const anchor =
        /(react_native_post_install\(\s*\n\s*installer,\s*\n\s*config\[:reactNativePath\],\s*\n\s*:mac_catalyst_enabled => false,\s*\n\s*:ccache_enabled => ccache_enabled\?\(podfile_properties\),\s*\n\s*\))/;
      if (!anchor.test(contents)) {
        console.warn('[withIosPodfilePostInstallFixes] react_native_post_install block not found; skipping');
        return cfg;
      }
      contents = contents.replace(anchor, `$1${RUBY_SNIPPET}`);
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
}

module.exports = withIosPodfilePostInstallFixes;

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './recorder.ico',
    extraResource: ['./dist',
      {
        "from": ".env",
        "to": ".env"
      }
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ggdrecorder',
        authors: 'GTT',
        exe: 'ggdrecorder.exe',
        setupExe: 'ggdrecorder_setup.exe',
        setupIcon: './recorder.ico',
        iconUrl: 'https://raw.githubusercontent.com/electron/electron/master/shell/browser/resources/win/electron.ico',
        noMsi: true,
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          perMachine: false,
          differentialPackage: true
        }
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
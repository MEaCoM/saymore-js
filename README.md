SayMore X is a reboot of SayMore (c# winforms) as a web app wrapped in electron, so that it can be used on Macs (and Windows, and Linux). The stack is Typescript, react, and mobx, ,built with webpack.

## Get Started

Install node, yarn, then

```bash
$ yarn
$ yarn lingui-compile
$ yarn dev
```

## Packaging

To package apps for the local platform:

```bash
$ npm run package
```

To package apps for all platforms:

First, refer to
[Multi Platform Build](https://www.electron.build/multi-platform-build) for
dependencies.

Then,

```bash
$ npm run package-all
```

To package apps with options:

```bash
$ npm run package -- --[option]
```

More information available in the upstream project:
[electron-react-typescript-boilerplate](https://github.com/iRath96/electron-react-typescript-boilerplate)

## Troubleshooting

### e2e

When running e2e tests, there is occasionally a mystery error (that I haven't recorded) that won't go away, even if you got back to previous commits. It goes away with a restart, `git clean -dxf && yarn && yarn build-production && yarn test-e2e`.

Make sure everything is committed first!

### l10n

When running Saymore, if you see this in the Chrome debug console:

`Uncaught Error: Cannot find module './en/messages.js'`

then you need to do `yarn lingui-compile`.

## License

MIT

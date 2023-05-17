## Setup

```console
shell:~$ nvm use
shell:~$ yarn install
shell:~$ yarn build
```

## How to run

The entry point CLI is executed with `yarn start`. Pass `--help` to show commands and arguments to commands:

```console
shell:~$ LOG_LEVEL=debug yarn start fix-sections-nrc-datasets \
         --url="http://admin:district@localhost:8080"
```

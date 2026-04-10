# Deploy Setup

## 1. Generate SSH key on your server

```
ssh-keygen -t rsa -b 4096 -m PEM -f ~/.ssh/deploy_rsa -N ""
```

## 2. Add public key to authorized_keys

```
cat ~/.ssh/deploy_rsa.pub >> ~/.ssh/authorized_keys
```

## 3. Print private key to copy into GitHub secret

```
cat ~/.ssh/deploy_rsa
```

Copy the entire output (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`) into the `SERVER_SSH_KEY` secret.

## GitHub Secrets required

Go to: GitHub repo > Settings > Environments > production > Environment secrets

| Secret | Value |
|---|---|
| SERVER_HOST | your server IP or domain |
| SERVER_USER | deploy |
| SERVER_SSH_KEY | contents of `~/.ssh/deploy_rsa` |
| SERVER_SSH_PORT | 22 (or your custom port) |

# macOS Setup Guide

## Sudo Configuration

To use the notebook profiling feature on macOS, you'll need to configure sudo to allow the [py-spy](https://github.com/benfred/py-spy) profiler to run as root without a password prompt. This is required because `py-spy` needs root privileges to attach to Python processes.

### Steps to Configure Sudo

1. Open Terminal and run the command:

```bash
which py-spy
```

and note down the path to the `py-spy` executable.

2. Run the command:

```bash
sudo visudo -f /private/etc/sudoers.d/myOverrides
```

3. Add the following entry to the file:

```
username ALL=(ALL) NOPASSWD: /path/to/py-spy
```

Replace `username` with your actual username and `/path/to/py-spy` with the path to the `py-spy` executable. This will allow you to run `sudo py-spy` without being prompted for a password.


### Security Note

Please be aware that this configuration reduces security by allowing `py-spy` to run with root privileges without a password. Only do this if you understand the security implications.

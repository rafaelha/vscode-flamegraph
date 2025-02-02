# macOS Setup Guide

## Sudo Configuration

To use the notebook profiling feature on macOS, you'll need to configure sudo to allow the `py-spy` profiler to run without a password prompt. This is required because `py-spy` needs root access to attach to Python processes.

### Steps to Configure Sudo

1. Open Terminal and run the command:

```bash
which py-spy
```

This will return the path to the `py-spy` executable. Note down this path.

2. Run the command:

```bash
sudo visudo -f /private/etc/sudoers.d/myOverrides
```

3. Add the following entry to the file:

```
username ALL=(ALL) NOPASSWD: /path/to/py-spy
```

Replace `username` with your actual username and `/path/to/py-spy` with the path to the `py-spy` executable.


### Security Note

Please be aware that this configuration reduces security by allowing `py-spy` to run with root privileges without a password. Only do this if you understand the security implications.

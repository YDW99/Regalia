#!/usr/bin/env python3
"""Validate uploaded signing identity without emitting any secret value."""
import hashlib
import os
from pathlib import Path
import re
import subprocess

required = ('RELEASE_KEYSTORE_PATH', 'RELEASE_KEYSTORE_PASSWORD', 'RELEASE_KEY_ALIAS', 'RELEASE_KEY_PASSWORD')
assert all(os.environ.get(name) for name in required), 'signing environment incomplete'
path = Path(os.environ['RELEASE_KEYSTORE_PATH'])
assert path.is_file(), 'keystore missing'
assert os.environ['RELEASE_KEY_ALIAS'] == 'regalia'
keystore_hash = hashlib.sha256(path.read_bytes()).hexdigest()
assert keystore_hash == '6a44f6607f4ed90fa6f4c52bedb8626d22ef285ba4127b68dd26975aaa522ccc'
java_home = Path(os.environ.get('JAVA_HOME', ''))
keytool = java_home / 'bin/keytool'
if not keytool.is_file():
    keytool = 'keytool'
p = subprocess.run([str(keytool), '-list', '-v', '-keystore', str(path), '-alias', os.environ['RELEASE_KEY_ALIAS'], '-storepass', os.environ['RELEASE_KEYSTORE_PASSWORD']], text=True, capture_output=True)
assert p.returncode == 0, 'keytool failed'
prints = re.findall(r'(?im)SHA-?256:\s*([0-9A-Fa-f:]+)', p.stdout)
actual = prints[0].replace(':', '').upper() if prints else ''
expected = '45BC6D36C9FCFF8EF9E55F510B43BCE44CB854EA4B2F235A0F4955DA05A8D8BC'
assert actual == expected, 'certificate identity mismatch'
print('keytool_exit=0')
print('alias_match=true')
print('certificate_sha256_match=true')
print('keystore_sha256_match=true')
print('SIGNING-KEY-IDENTITY OK')

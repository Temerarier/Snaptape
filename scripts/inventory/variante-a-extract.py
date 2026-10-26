"""Read only the uploaded reference bundle; extract into a disposable /tmp directory."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import tempfile
import zipfile

archive = Path(sys.argv[1])
with zipfile.ZipFile(archive) as outer:
    candidates = [n for n in outer.namelist() if n.endswith("/snaptape-variante-a-replit-paket.zip")]
    if len(candidates) != 1:
        raise ValueError("Expected exactly one original Variante-A ZIP")
    member = candidates[0]
    if outer.getinfo(member).file_size > 20_000_000:
        raise ValueError("Nested archive exceeds inventory limit")
    payload = outer.read(member)

temporary = Path(tempfile.mkdtemp(prefix="snaptape-inventory-variante-a-"))
try:
    manifest = []
    with zipfile.ZipFile(io.BytesIO(payload)) as inner:
        if len(inner.infolist()) > 1000 or sum(i.file_size for i in inner.infolist()) > 20_000_000:
            raise ValueError("Unexpected reference package size")
        for item in inner.infolist():
            name = PurePosixPath(item.filename)
            if name.is_absolute() or ".." in name.parts or "\\" in item.filename:
                raise ValueError("Unsafe archive path")
            if not name.parts or name.parts[0] != "variante-a-paket":
                raise ValueError("Unexpected reference package root")
            if stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError("Archive symlink refused")
            if item.is_dir():
                continue
            data = inner.read(item)
            target = temporary.joinpath(*name.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            manifest.append({
                "path": item.filename,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            })
    evidence = {
        "sourceArchive": str(archive),
        "sourceArchiveBytes": archive.stat().st_size,
        "sourceArchiveSha256": hashlib.file_digest(archive.open("rb"), "sha256").hexdigest(),
        "nestedMember": member,
        "nestedArchiveBytes": len(payload),
        "nestedArchiveSha256": hashlib.sha256(payload).hexdigest(),
        "fileCount": len(manifest),
        "uncompressedFileBytes": sum(f["bytes"] for f in manifest),
        "files": sorted(manifest, key=lambda f: f["path"]),
        "method": "Original nested ZIP, regular files only, temporary extraction, no workspace package copied or installed.",
    }
    Path("scripts/inventory/variante-a-manifest.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"temporary": str(temporary), "root": str(temporary / "variante-a-paket")}))
except BaseException:
    shutil.rmtree(temporary)
    raise

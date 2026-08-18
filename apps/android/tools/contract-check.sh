#!/usr/bin/env bash
#
# Runs the Android app's API interface and models against a real server.
#
# The Compose UI needs the Android SDK to compile. This does not: the models,
# the Retrofit interface and the error handling are ordinary Kotlin, and they
# are the layer most likely to be silently wrong. A field the API renamed or a
# null the client did not expect is a crash on a resident's phone, and reading
# the code does not catch it — running it does.
#
#   ./contract-check.sh [API_URL] [EMAIL] [PASSWORD]
#
# Needs a JDK and network access to Maven Central. Nothing from Google.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/../app/src/main/java/com/prangan/society"
CACHE="${CONTRACT_CHECK_CACHE:-${TMPDIR:-/tmp}/prangan-contract-check}"
OUT="$CACHE/classes"

KOTLIN=2.0.21
CENTRAL=https://repo1.maven.org/maven2

mkdir -p "$CACHE/jars" "$OUT"

# Fetch, then check it is really a jar. A rate-limit page saved under a .jar
# name fails later with an unreadable zip error, which is a bad half-hour.
fetch() {
  local path="$1" file="$CACHE/jars/$(basename "$1")"
  if [ -s "$file" ] && python3 -c "import zipfile,sys; zipfile.ZipFile('$file')" 2>/dev/null; then return; fi
  echo "  fetching $(basename "$1")"
  curl -sSL --retry 3 -m 300 -o "$file" "$CENTRAL/$path"
  python3 -c "import zipfile; zipfile.ZipFile('$file')" 2>/dev/null || {
    echo "!! $(basename "$1") did not download as a jar — check the first line:" >&2
    head -c 200 "$file" >&2; echo >&2; exit 1
  }
}

echo "dependencies:"
fetch "org/jetbrains/kotlin/kotlin-compiler-embeddable/$KOTLIN/kotlin-compiler-embeddable-$KOTLIN.jar"
fetch "org/jetbrains/kotlin/kotlin-stdlib/$KOTLIN/kotlin-stdlib-$KOTLIN.jar"
fetch "org/jetbrains/kotlin/kotlin-script-runtime/$KOTLIN/kotlin-script-runtime-$KOTLIN.jar"
fetch "org/jetbrains/kotlin/kotlin-daemon-embeddable/$KOTLIN/kotlin-daemon-embeddable-$KOTLIN.jar"
fetch "org/jetbrains/kotlin/kotlin-serialization-compiler-plugin-embeddable/$KOTLIN/kotlin-serialization-compiler-plugin-embeddable-$KOTLIN.jar"
fetch "org/jetbrains/intellij/deps/trove4j/1.0.20200330/trove4j-1.0.20200330.jar"
fetch "org/jetbrains/annotations/23.0.0/annotations-23.0.0.jar"
fetch "org/jetbrains/kotlinx/kotlinx-coroutines-core-jvm/1.8.1/kotlinx-coroutines-core-jvm-1.8.1.jar"
fetch "org/jetbrains/kotlinx/kotlinx-serialization-core-jvm/1.7.3/kotlinx-serialization-core-jvm-1.7.3.jar"
fetch "org/jetbrains/kotlinx/kotlinx-serialization-json-jvm/1.7.3/kotlinx-serialization-json-jvm-1.7.3.jar"
fetch "com/squareup/retrofit2/retrofit/2.11.0/retrofit-2.11.0.jar"
fetch "com/squareup/okhttp3/okhttp/4.12.0/okhttp-4.12.0.jar"
fetch "com/squareup/okio/okio-jvm/3.6.0/okio-jvm-3.6.0.jar"
fetch "com/jakewharton/retrofit/retrofit2-kotlinx-serialization-converter/1.0.0/retrofit2-kotlinx-serialization-converter-1.0.0.jar"

CP=$(ls "$CACHE"/jars/*.jar | tr '\n' ':')
COMPILER="$CACHE/jars/kotlin-compiler-embeddable-$KOTLIN.jar:$CACHE/jars/kotlin-stdlib-$KOTLIN.jar:$CACHE/jars/kotlin-daemon-embeddable-$KOTLIN.jar:$CACHE/jars/kotlin-script-runtime-$KOTLIN.jar:$CACHE/jars/trove4j-1.0.20200330.jar:$CACHE/jars/annotations-23.0.0.jar:$CACHE/jars/kotlinx-coroutines-core-jvm-1.8.1.jar"

echo "compiling the contract layer:"
java -cp "$COMPILER" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler \
  -no-stdlib -no-reflect -nowarn -classpath "$CP" -d "$OUT" \
  -Xplugin="$CACHE/jars/kotlin-serialization-compiler-plugin-embeddable-$KOTLIN.jar" \
  "$SRC/core/model/Models.kt" "$SRC/core/net/Api.kt" "$SRC/core/net/ApiError.kt" \
  "$HERE/ContractCheck.kt" 2>&1 | grep -vE "^(warning:|info:)" || true

echo "running against ${1:-http://127.0.0.1:4210}:"
java -cp "$OUT:$CP" harness.ContractCheckKt "$@"

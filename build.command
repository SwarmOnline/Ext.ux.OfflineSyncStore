#!/bin/sh
here="`dirname \"$0\"`"

cd "$here" || exit 1

java -jar builder/JSBuilder2.jar -v -p builder/Ext.ux.OfflineSyncStore.jsb2 -d .
@echo off
set VER=1.2.2

sed -i -E "s/version>.+?</version>%VER%</" install.rdf
sed -i -E "s/version>.+?</version>%VER%</; s/download\/.+?\/pxruler-.+?\.xpi/download\/%VER%\/pxruler-%VER%\.xpi/" update.xml

set XPI=pxruler-%VER%.xpi
if exist %XPI% del %XPI%
zip -r9q %XPI% * -x .git/* .gitignore update.xml LICENSE README.md *.cmd *.xpi *.exe

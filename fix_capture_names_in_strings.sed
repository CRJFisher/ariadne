#!/usr/bin/sed -f
# Replace abbreviated capture names inside quoted strings in TypeScript files

# Core abbreviations in strings
s/"def\./"definition./g
s/"ref\./"reference./g
s/"assign\./"assignment./g
s/'\''def\.'\''/'\''definition./g
s/'\''ref\.'\''/'\''reference./g
s/'\''assign\.'\''/'\''assignment./g
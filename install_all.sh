#!/bin/bash

pi install npm:pi-extension-manager &
pi install npm:pi-subagents &
pi install npm:@plannotator/pi-extension &
pi install npm:@tmustier/pi-usage-extension &
pi install npm:@studiosunnyfield/pimagotchi &
pi install npm:pi-connect &
pi install npm:pi-animations &
pi install npm:pi-tokensaver &
cargo install tokensave &

wait
echo "All plugins installed!"

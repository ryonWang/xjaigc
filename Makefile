.PHONY: run-mac
run-mac:
	# /Applications/美搭AI数字人.app/Contents/MacOS/美搭AI数字人
	rm -rfv /Applications/美搭AI数字人.app;
	cp -a ./dist-release/mac-arm64/美搭AI数字人.app /Applications
	/Applications/美搭AI数字人.app/Contents/MacOS/美搭AI数字人

.PHONY: run-win
run-win:
	./dist-release/win-unpacked/美搭AI数字人.exe

build_and_install:
	npm run build;
	rm -rfv /Applications/美搭AI数字人.app;
	cp -a ./dist-release/mac-arm64/美搭AI数字人.app /Applications

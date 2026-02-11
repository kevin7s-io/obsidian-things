export class Plugin {
	app: any = {};
	manifest: any = {};
	loadData = vi.fn().mockResolvedValue({});
	saveData = vi.fn().mockResolvedValue(undefined);
	addCommand = vi.fn();
	addSettingTab = vi.fn();
	addRibbonIcon = vi.fn();
	addStatusBarItem = vi.fn().mockReturnValue({ setText: vi.fn() });
	registerView = vi.fn();
	registerMarkdownCodeBlockProcessor = vi.fn();
	registerEvent = vi.fn();
	registerDomEvent = vi.fn();
	registerInterval = vi.fn();
}

export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl: any = { empty: vi.fn(), createEl: vi.fn() };
	constructor(app: any, plugin: any) {
		this.app = app;
		this.plugin = plugin;
	}
	display() {}
	hide() {}
}

export class Setting {
	constructor(_containerEl: any) {}
	setName(_name: string) { return this; }
	setDesc(_desc: string) { return this; }
	addText(cb: any) { cb({ setValue: () => ({ onChange: () => ({}) }), setPlaceholder: () => ({ setValue: () => ({ onChange: () => ({}) }) }), inputEl: {} }); return this; }
	addToggle(cb: any) { cb({ setValue: () => ({ onChange: () => ({}) }) }); return this; }
	addDropdown(cb: any) { cb({ addOption: () => ({ addOption: () => ({}) }), setValue: () => ({ onChange: () => ({}) }) }); return this; }
	addSlider(cb: any) { cb({ setLimits: () => ({ setValue: () => ({ setDynamicTooltip: () => ({ onChange: () => ({}) }) }) }) }); return this; }
	addButton(cb: any) { cb({ setButtonText: () => ({ onClick: () => ({}) }), setCta: () => ({}) }); return this; }
}

export class Notice { constructor(_message: string) {} }
export class TFile { path = ""; basename = ""; extension = ""; }

export const Platform = {
	isMacOS: true,
	isDesktopApp: true,
	isMobileApp: false,
};

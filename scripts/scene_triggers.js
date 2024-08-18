export default class TriggersSceneConfig extends SceneConfig {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "modules/soundscape-adventure/templates/triggers-scene-config.hbs",
      tabs: [{ navSelector: ".tabs", contentSelector: ".tab-content", initial: "basic" }]
    });
  }

  /** @override */
  async getData(options) {
    const data = await super.getData(options);
    // Adicione qualquer dado adicional necessário para seu template
    data.myCustomSetting = this.object.getFlag("soundscape-adventure", "myCustomSetting") || false;
    return data;
  }

  /** @override */
  async _updateObject(event, formData) {
    // Salve a configuração personalizada
    await this.object.setFlag("soundscape-adventure", "myCustomSetting", formData.myCustomSetting);
    return super._updateObject(event, formData);
  }
}

// Registrar a nova folha de configuração de cena


# Changelog

Todas as mudanças relevantes deste projeto serão registradas aqui.

## [0.1.0] - 2026-04-08

### Adicionado
- empacotamento desktop com Electron para o ORION Console
- build standalone do bridge Python com PyInstaller
- scripts de desenvolvimento e build para o fluxo desktop
- detecção de ambiente Electron no frontend para usar o bridge local corretamente
- logging básico de runtime do Electron para diagnóstico de inicialização

### Alterado
- o frontend passou a gerar assets com caminhos relativos para funcionar corretamente no `file://` do Electron
- o fluxo principal do projeto agora é o desktop em Electron, não mais o dashboard Tkinter
- a documentação foi atualizada para refletir o novo processo de desenvolvimento e entrega

### Removido
- dashboard legado em Tkinter
- wrappers antigos de PowerShell para subir bridge e frontend separadamente

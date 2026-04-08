# Changelog

Todas as mudancas relevantes deste projeto sao registradas aqui.

## [0.1.0] - 2026-04-08

### Adicionado
- aplicativo desktop com Electron como fluxo principal do ORION Console
- build standalone do bridge Python com PyInstaller, empacotado junto do executavel
- catalogo dinamico de topicos do SmartDashboard para uso com robos diferentes
- workspace oculto de telemetria customizada com pinagem de topicos no quadro
- escrita de topicos escalares editaveis para tuning em tempo real
- widget de bateria com historico, tendencia e estimativa de runtime
- workspace oculto de controle remoto para testes em teleop
- drawer de configuracoes com temas, presets de layout, trava de layout e slots de camera
- suporte a camera por URL com modos MJPEG, snapshot e video
- widgets configuraveis por topico com modos de exibicao em texto, booleano, bar, gauge e graph
- configuracao por widget de faixa minima e maxima, threshold booleano, zonas de alerta e tamanho do card

### Alterado
- o frontend passou a usar assets relativos para funcionar corretamente no `file://` do Electron
- a leitura de heading e gyro passou a priorizar fontes de yaw ao vivo quando o robo esta desabilitado
- as preferencias visuais do operador agora ficam persistidas localmente
- a selecao de tema saiu da barra principal e foi movida para o painel de configuracoes

### Removido
- dashboard legado em Tkinter
- wrappers antigos de PowerShell para subir frontend e bridge separadamente

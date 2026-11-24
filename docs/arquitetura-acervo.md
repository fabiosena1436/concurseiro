# Acervo inteligente de concursos

## Estado atual

O projeto usa React, Firebase Authentication, Firestore, Storage e Cloud Functions. A área `/admin/acervo` agora contém uma fila de **fontes para análise**. O administrador cola linhas tabuladas com título, ano, banca, órgão, cargo e URL HTTPS. A API valida as linhas, normaliza a URL, ignora parâmetros de rastreamento e usa o hash da URL como identificador estável. Lotes repetidos não criam outra fonte. A fila só é acessível com a claim `admin`.

Ao escolher uma fonte, o formulário de prova é preenchido como rascunho. O administrador confere os dados, obtém o PDF de uma fonte cuja reutilização seja permitida e o envia. A publicação exige confirmação dos direitos. A importação de questões existente recebe texto, cria rascunhos por IA sem gabarito e exige revisão humana antes da publicação. Esse limite evita que uma extração incompleta se transforme em questão oficial.

## Próximas etapas de ingestão

1. **Fontes autorizadas.** Criar um registro por órgão ou banca com URL do portal, contato, licença/termo, escopo permitido, frequência de consulta e estado ativo. PCI e TEC só entram com autorização escrita específica para integração comercial; usar suas interfaces como referência de navegação não concede direito ao conteúdo.
2. **Conectores por fonte.** Preferir API, RSS, sitemap ou listagem oficial. Cada conector deve entregar apenas metadados e URL da prova. Usar agendamento com limite por domínio, `ETag`/`Last-Modified`, recuo em erros e logs. Nunca usar uma URL arbitrária informada pelo cliente para a função de coleta.
3. **Ingestão de PDFs autorizados.** Guardar arquivo original, URL, data de obtenção, hash SHA-256 e versão. Deduplicar por hash de arquivo e por identidade da prova. Distinguir caderno, gabarito preliminar, gabarito definitivo e retificação.
4. **Extração.** Extrair texto por página; aplicar OCR somente em páginas digitalizadas. Dividir por número da questão e preservar página, trechos de origem, imagens e tabelas. Enviar lotes pequenos à IA com saída estruturada. Ela deve sugerir classificação e apontar incerteza, sem inventar gabarito ou explicação oficial.
5. **Validação.** Conferir número de questões, alternativas, referências a figuras, gabarito definitivo e duplicatas. Rascunhos com divergência vão para uma fila de exceções. Amostrar uma fração de cada lote além de revisar todas as exceções. Registrar modelo, prompt, custo, versão e pessoa responsável pela aprovação.
6. **Busca.** Manter filtros estruturados no Firestore enquanto o acervo for pequeno. Quando a busca por texto crescer, adicionar um índice próprio (por exemplo Meilisearch/OpenSearch) alimentado por eventos de publicação. Vetores podem ajudar a encontrar questões semanticamente semelhantes, mas não substituem filtros exatos nem a referência à prova.
7. **Venda.** Definir planos e limites de acesso depois de medir custo por questão e uso real. Pagamentos e acesso devem ser confirmados por webhook no servidor, nunca por estado gravado pelo navegador.

## Critérios para produção

- Só publicar uma prova ou questão com procedência rastreável e direitos de uso revisados.
- Manter gabarito preliminar e definitivo separados; alterações geram nova revisão.
- Impedir publicação quando OCR perder figura, tabela, fórmula ou alternativas.
- Medir taxa de duplicatas, cobertura de provas, tempo de revisão, erros de extração e custo de IA por questão aprovada.
- Subir Functions, regras, índices e frontend da mesma revisão do código; validar com uma prova real autorizada antes de ampliar o volume.

## Pesquisa de fontes gratuitas (24/11/2026)

**Gratuito para baixar não significa livre para republicar ou vender.** Para cada fonte, salvar a página de origem, o detentor dos direitos, a licença/termo e a decisão de uso. Quando o uso comercial não estiver claro, manter só o link na fila até obter permissão.

| Prioridade | Fonte | O que há | Uso proposto |
| --- | --- | --- | --- |
| Alta | [MGI: CNU](https://www.gov.br/gestao/pt-br/concursonacional/caderno-de-provas-e-gabaritos) | Cadernos e gabaritos preliminares e finais | Testar o conector de páginas oficiais e a reconciliação de gabaritos. Conferir direitos de redistribuição antes de hospedar PDFs. |
| Alta | [Inep: Prova Nacional Docente](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/prova-nacional-docente/provas-e-gabaritos) | Provas por área e tipo, gabaritos e retificações | Bom piloto de prova completa com variantes; conferir licença do conteúdo. |
| Alta | [Inep: Enem](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos) e [microdados](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem) | Série histórica de cadernos, gabaritos e dados de itens | Acervo complementar, fora do foco de concursos; microdados são a melhor entrada estruturada. Verificar licença do conjunto específico. |
| Média | [Inep: Enade](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade-das-licenciaturas/provas-e-gabaritos/2024) | Provas, gabaritos e mapas por área | Acervo complementar para docentes e formação geral. |
| Média | [Cebraspe](https://www.cebraspe.org.br/concursos/DER_AL_26), [FGV](https://enare2026.conhecimento.fgv.br/provas/) e [Instituto AOCP](https://www.institutoaocp.org.br/concursos/status/i) | Páginas públicas de certames com provas e gabaritos | Descobrir metadados e apontar à página original; solicitar autorização antes de copiar em massa ou explorar comercialmente. |
| Piloto de API aberta | [Roca Sales: dados de concursos](https://www.rocasales.rs.gov.br/dados-abertos) | API JSON/CSV com 19 registros de concursos, licença CC BY 4.0 | Boa fonte de metadados para testar agendamento e atribuição, mas não fornece cadernos de questões. A [API atual](https://www.rocasales.rs.gov.br/api/dados/concursos?formato=json) inclui URLs de edital com `localhost`; validar e substituir pela página oficial antes de exibir. |
| Condicional | [PCI Concursos](https://www.pciconcursos.com.br/termos-de-uso) e [TEC Concursos](https://www.tecconcursos.com.br/termos-de-uso) | Acervos amplos, mas com restrições expressas | Sem conector, coleta massiva ou uso em IA até existir autorização escrita aplicável. |

## Busca automatizada

1. Agendar a consulta de fontes **aprovadas** com Cloud Scheduler. Em cada execução, respeitar `robots.txt`, termos, limites e `ETag`/`Last-Modified`; guardar apenas metadados na fila. [Firebase documenta o agendamento](https://firebase.google.com/docs/functions/schedule-functions).
2. Quando a cobertura dessas fontes cair, usar um provedor de pesquisa web para descobrir **URLs candidatas**. A IA classifica cargo, ano, banca, tipo de prova e provável gabarito; o servidor valida o domínio e registra a origem. Resultado de busca não deve ser tratado como licença nem como gabarito.
3. Ordenar a fila por relevância para os cargos e bancas escolhidos, novidade, presença de gabarito definitivo, qualidade do PDF e situação dos direitos. Mostrar por que cada item foi sugerido.
4. Extrair texto por página e usar OCR apenas quando necessário. A IA estrutura enunciado e alternativas, compara número de itens com o gabarito e sinaliza lacunas. [Gemini documenta leitura de PDFs com texto e elementos visuais](https://aistudio.google.com/docs/document-processing); ainda assim, a revisão das figuras, fórmulas e respostas é obrigatória.

## Telegram como radar

O [Bot API](https://core.telegram.org/bots/api) recebe atualizações novas por webhook ou `getUpdates`; não oferece histórico ilimitado ao bot. Em grupos, o [modo de privacidade](https://core.telegram.org/bots/features) limita as mensagens visíveis por padrão. Um bot no grupo ou um usuário que encaminha uma mensagem ao bot pode criar uma candidata na fila com link, remetente/canal, data e tipo de arquivo. O bot não deve publicar o arquivo automaticamente.

Na sessão local observada, havia canais de questões, grupos temáticos de concurso e um bot que promove cursos pagos. Essa observação não comprova licença sobre os materiais. [As condições de licenciamento do Telegram](https://telegram.org/tos/content-licensing) exigem respeito aos direitos do titular. Para cada documento, buscar a publicação original do órgão ou banca; se for apostila, curso, comentário de professor ou arquivo vendido, pedir licença separada. Comprar acesso pessoal não concede direito de redistribuir. O [Bot API limita o download padrão de arquivos a 20 MB](https://core.telegram.org/bots/api), o que também favorece receber links de origem em vez de copiar anexos.

Para avaliar uma fonte paga, registrar: preço total, licença escrita para exibição comercial e processamento por IA, quantidade de questões realmente novas, presença de gabarito definitivo, correções posteriores, formato exportável e prazo de suporte. Comparar **custo por questão nova aprovada** = (licença + processamento + revisão) / quantidade de questões inéditas publicáveis. Sem licença de redistribuição, a fonte serve apenas para estudo pessoal e não entra na conta de aquisição do acervo.

## Assistente do aluno

A rota de questão possui agora um tutor que recebe apenas o enunciado revisado e as alternativas, dá uma dica sem gabarito e permite uma pergunta curta. A API exige login e limita a 20 chamadas por conta/dia. A resposta da IA é apoio ao raciocínio, não correção oficial. Na expansão, buscar primeiro comentários próprios revisados e referências confiáveis; citar a prova, a página e a norma/versão quando houver. Medir se a dica ajudou e registrar erros apontados pelos alunos para revisão editorial.

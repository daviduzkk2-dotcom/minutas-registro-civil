# Minutas do Registro Civil

Site estático que monta minutas (declaração de pobreza para 2ª via de certidão) e gera o PDF
**no próprio navegador**. Não há servidor, banco de dados, cookies nem estatísticas: nada do que é
digitado é salvo ou enviado, exceto o CEP, consultado no ViaCEP para completar o endereço.

- Lista de cartórios: CNJ – Justiça Aberta (serventias ativas de Registro Civil das Pessoas Naturais).
- PDF: pdfmake 0.2.10 (em `vendor/`).

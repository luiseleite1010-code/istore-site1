export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' });

  try {
    const { valor, nome, cpf, descricao } = req.body || {};
    if (!valor || !nome || !cpf) return res.status(400).json({ erro: 'valor, nome, cpf obrigatorios' });

    const SIMPAY_API_TOKEN = process.env.SIMPAY_API_TOKEN;
    const SELLER_DOCUMENT  = process.env.SELLER_DOCUMENT;
    const valorReais       = parseFloat(valor).toFixed(2);

    const response = await fetch('https://api.somossimpay.com.br/api/checkout/external/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'X-Api-Token':  SIMPAY_API_TOKEN,
      },
      body: JSON.stringify({
        payment_method:  'pix',
        postback_url:    'https://istore-site1.vercel.app/api/webhook-pix',
        tax_cost:        0,
        discount:        0,
        delivery_cost:   parseFloat(valorReais),
        seller_document: SELLER_DOCUMENT || null,
        customer: {
          name:               nome,
          official_id_number: cpf.replace(/\D/g, ''),
          official_id_type:   'cpf',
        },
        products: [{
          external_id:  'FRETE-ISTORE',
          name:         descricao || 'Frete iStore',
          description:  'Frete expresso',
          price:        parseFloat(valorReais),
          amount:       1,
          is_digital:   true,
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(502).json({ erro: 'Erro Simpay', detalhe: data });

    const sale    = data.sale || data;
    const payment = sale.payment || {};
    const details = payment.details || {};
    const saleId  = sale.id || '';
    const qrcode  = details.pix_copy_paste || details.brcode || details.qr_code || '';
    const qrcodeImage = details.qr_code_url || (qrcode
      ? 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrcode)
      : '');

    return res.status(200).json({ txid: saleId, qrcode, qrcodeImage, valor: valorReais, status: sale.status || 'ATIVA', raw: data });

  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

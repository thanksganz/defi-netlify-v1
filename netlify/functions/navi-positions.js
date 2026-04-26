function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function(event, context) {
  var body = JSON.parse(event.body || '{}');
  var wallet = body.wallet;

  if (!wallet) {
    return json(400, { error: 'Нужен Sui-адрес' });
  }

  return json(200, {
    protocol: 'NAVI Lending',
    chain: 'sui',
    suppliedUSD: null,
    borrowedUSD: null,
    collateralUSD: null,
    healthFactor: null,
    assets: [],
    note: 'Каркас адаптера готов. Следующий шаг — подключить NAVI SDK.'
  });
};

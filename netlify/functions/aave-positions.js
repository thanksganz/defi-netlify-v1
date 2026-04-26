// Aave V3 - реальная интеграция через Alchemy
const ALCHEMY_URL = 'https://arb-mainnet.g.alchemy.com/v2/ksyAQZ9F6Th6bIhUspYkKn-CeIUqyXcu';

// Aave V3 Pool Data Provider на Arbitrum
const AAVE_POOL_DATA_PROVIDER = '0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654';

// ABI для Pool Data Provider
const ABI = [
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getUserReservesData",
    "outputs": [
      {
        "components": [
          {"internalType": "address", "name": "underlyingAsset", "type": "address"},
          {"internalType": "uint256", "name": "scaledATokenBalance", "type": "uint256"},
          {"internalType": "uint256", "name": "usageAsCollateralEnabledOnUser", "type": "bool"},
          {"internalType": "uint256", "name": "scaledVariableDebt", "type": "uint256"},
          {"internalType": "uint256", "name": "principalStableDebt", "type": "uint256"},
          {"internalType": "uint256", "name": "currentATokenBalance", "type": "uint256"},
          {"internalType": "uint256", "name": "currentVariableDebt", "type": "uint256"},
          {"internalType": "uint256", "name": "currentStableDebt", "type": "uint256"},
          {"internalType": "uint256", "name": "currentLiquidationThreshold", "type": "uint256"},
          {"internalType": "uint256", "name": "ltv", "type": "uint256"},
          {"internalType": "uint256", "name": "healthFactor", "type": "uint256"}
        ],
        "internalType": "struct IPoolDataProvider.UserReserveData[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Токены и их символы
const TOKEN_SYMBOLS = {
  '0x912CE59144191C1204E64559FE8253a0e49E6548': 'ARB',
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1': 'WETH',
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': 'USDC',
  '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9': 'USDT',
  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1': 'DAI',
  '0xba5DdD1f9d7F570d94A5142F6b52C044d5B0F58c': 'USDT0'
};

const TOKEN_DECIMALS = {
  'ARB': 18, 'WETH': 18, 'USDC': 6, 'USDT': 6, 'DAI': 18, 'USDT0': 6
};

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

async function callAlchemy(method, params) {
  const response = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: method,
      params: params
    })
  });
  
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.result;
}

exports.handler = async function(event, context) {
  try {
    var body = JSON.parse(event.body || '{}');
    var wallet = body.wallet;
    var chain = body.chain || 'arbitrum';

    if (!wallet || !wallet.startsWith('0x')) {
      return json(400, { error: 'Нужен EVM-адрес 0x...' });
    }

    // Вызываем getUserReservesData через eth_call
    const callData = {
      to: AAVE_POOL_DATA_PROVIDER,
      data: '0xbf92857c' + wallet.toLowerCase().slice(2).padStart(64, '0')
    };

    // Получаем резервы пользователя
    const result = await callAlchemy('eth_call', [callData, 'latest']);
    
    if (!result || result === '0x') {
      return json(200, {
        protocol: 'Aave V3',
        chain: chain,
        netWorth: 0,
        suppliedUSD: 0,
        borrowedUSD: 0,
        healthFactor: null,
        assets: [],
        borrows: [],
        note: 'Нет позиций в Aave V3 на Arbitrum'
      });
    }

    // Декодируем результат (упрощенно)
    // В реальности здесь нужен полный ABI decoder
    return json(200, {
      protocol: 'Aave V3',
      chain: chain,
      wallet: wallet,
      rawData: result.slice(0, 100) + '...',
      note: 'Alchemy подключен. Требуется полная реализация декодирования данных.',
      nextSteps: [
        'Добавить полный ABI decoder',
        'Получить цены токенов',
        'Рассчитать USD значения'
      ]
    });

  } catch (e) {
    console.error('Error:', e);
    return json(500, { 
      error: e.message || 'Server error',
      details: 'Ошибка при запросе к Alchemy'
    });
  }
};

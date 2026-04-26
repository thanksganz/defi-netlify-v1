// Aave V3 + все DeFi позиции через DeBank API
// DeBank автоматически агрегирует позиции со всех протоколов

const DEBANK_API = 'https://pro-openapi.debank.com/v1';
const DEBANK_API_KEY = process.env.DEBANK_API_KEY || '';

// Кэш для fallback
const USER_CACHE = {
  '0xc863b4ba2173e84d9549fcb7ef09caecaca99714': {
    netWorth: 191.86,
    suppliedUSD: 237.38,
    borrowedUSD: 45.52,
    healthFactor: 3.28,
    assets: [{ symbol: 'ARB', role: 'collateral', amount: '1824.60', usdValue: 237.38 }],
    borrows: [{ symbol: 'USD₮0', amount: '45.51', usdValue: 45.52 }]
  }
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

async function fetchDeBank(endpoint) {
  const headers = {
    'Accept': 'application/json'
  };
  
  if (DEBANK_API_KEY) {
    headers['AccessKey'] = DEBANK_API_KEY;
  }
  
  const response = await fetch(`${DEBANK_API}${endpoint}`, { headers });
  
  if (!response.ok) {
    throw new Error(`DeBank API error: ${response.status}`);
  }
  
  return response.json();
}

exports.handler = async function(event, context) {
  let wallet, chain;
  
  try {
    const body = JSON.parse(event.body || '{}');
    wallet = body.wallet;
    chain = body.chain || 'arbitrum';

    if (!wallet || !wallet.startsWith('0x')) {
      return json(400, { error: 'Нужен EVM-адрес 0x...' });
    }

    // Получаем сложные позиции (lending, pools)
    const protocolList = await fetchDeBank(`/user/protocol_list?id=${wallet}&chain_id=arb`);
    
    // Ищем Aave V3
    const aaveProtocol = protocolList.find(p => 
      p.id === 'aave3' || p.name?.toLowerCase().includes('aave')
    );
    
    if (!aaveProtocol) {
      return json(200, {
        protocol: 'Aave V3',
        chain: chain,
        netWorth: 0,
        suppliedUSD: 0,
        borrowedUSD: 0,
        healthFactor: null,
        assets: [],
        borrows: [],
        note: 'Позиции в Aave V3 не найдены через DeBank',
        allProtocols: protocolList.map(p => ({ id: p.id, name: p.name }))
      });
    }

    // Парсим данные Aave
    const supplied = [];
    const borrowed = [];
    let suppliedUSD = 0;
    let borrowedUSD = 0;

    for (const item of aaveProtocol.portfolio_item_list || []) {
      // Supply positions
      if (item.supply_token_list) {
        for (const token of item.supply_token_list) {
          const amount = Number(token.amount || 0);
          const price = Number(token.price || 0);
          const usdValue = amount * price;
          
          if (usdValue > 0.01) {
            suppliedUSD += usdValue;
            supplied.push({
              symbol: token.symbol,
              role: token.is_collateral ? 'collateral' : 'supply',
              amount: amount.toFixed(4),
              usdValue: usdValue
            });
          }
        }
      }
      
      // Borrow positions
      if (item.borrow_token_list) {
        for (const token of item.borrow_token_list) {
          const amount = Number(token.amount || 0);
          const price = Number(token.price || 0);
          const usdValue = amount * price;
          
          if (usdValue > 0.01) {
            borrowedUSD += usdValue;
            borrowed.push({
              symbol: token.symbol,
              amount: amount.toFixed(4),
              usdValue: usdValue
            });
          }
        }
      }
    }

    const netWorth = suppliedUSD - borrowedUSD;
    const healthFactor = aaveProtocol.portfolio_item_list?.[0]?.stats?.health_rate || null;

    return json(200, {
      protocol: 'Aave V3',
      chain: chain,
      wallet: wallet,
      netWorth: netWorth.toFixed(2),
      suppliedUSD: suppliedUSD.toFixed(2),
      borrowedUSD: borrowedUSD.toFixed(2),
      healthFactor: healthFactor,
      assets: supplied,
      borrows: borrowed,
      source: 'DeBank API',
      note: 'Реальные данные, автоматически обновляются',
      lastUpdated: new Date().toISOString()
    });

  } catch (e) {
    console.error('Error:', e);
    
    // Fallback к кэшу
    const walletLower = (wallet || '').toLowerCase();
    const cached = USER_CACHE[walletLower];
    
    if (cached) {
      return json(200, {
        protocol: 'Aave V3',
        chain: chain,
        ...cached,
        source: 'cache (fallback)',
        note: 'Данные из кэша. Для автоматического обновления получите DeBank API ключ.',
        error: e.message
      });
    }
    
    return json(500, { 
      error: e.message || 'Server error',
      solution: 'Получите бесплатный API ключ на debank.com/pro'
    });
  }
};

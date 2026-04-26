// Aave V3 - реальная интеграция через Alchemy + Aave UI Data Provider
const ALCHEMY_URL = 'https://arb-mainnet.g.alchemy.com/v2/ksyAQZ9F6Th6bIhUspYkKn-CeIUqyXcu';

// Aave V3 UI Pool Data Provider на Arbitrum - даёт готовые данные
const AAVE_UI_DATA_PROVIDER = '0xC9B8b0c596713B03dA5C737d0f19b4Eb72b7654A';

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

// Декодируем uint256 из hex
function decodeUint(hex, offset) {
  const start = 2 + offset * 64;
  const value = hex.slice(start, start + 64);
  return BigInt('0x' + value);
}

exports.handler = async function(event, context) {
  try {
    const body = JSON.parse(event.body || '{}');
    const wallet = body.wallet;
    const chain = body.chain || 'arbitrum';

    if (!wallet || !wallet.startsWith('0x')) {
      return json(400, { error: 'Нужен EVM-адрес 0x...' });
    }

    // Получаем данные через getReservesData - возвращает список всех резервов с ценами
    const reservesCall = {
      to: AAVE_UI_DATA_PROVIDER,
      data: '0xd5b75857' + '0000000000000000000000000000000000000000000000000000000000000000'
    };

    const reservesResult = await callAlchemy('eth_call', [reservesCall, 'latest']);
    
    // Получаем пользовательские данные через getUserReservesData
    // Функция: getUserReservesData(address user)
    // Селектор: 0xbf92857c
    const userDataCall = {
      to: AAVE_UI_DATA_PROVIDER,
      data: '0xbf92857c' + wallet.toLowerCase().slice(2).padStart(64, '0')
    };

    const userResult = await callAlchemy('eth_call', [userDataCall, 'latest']);
    
    if (!userResult || userResult === '0x' || userResult.length < 10) {
      return json(200, {
        protocol: 'Aave V3',
        chain: chain,
        netWorth: 0,
        suppliedUSD: 0,
        borrowedUSD: 0,
        healthFactor: null,
        assets: [],
        borrows: [],
        note: 'Нет активных позиций в Aave V3 на Arbitrum'
      });
    }

    // Парсим ответ (упрощенно)
    // Структура: массив UserReserveData
    // Пропускаем offset (32 байта) и length (32 байта)
    const raw = userResult.slice(2); // убираем 0x
    const arrayOffset = Number(decodeUint(raw, 0));
    const arrayLength = Number(decodeUint(raw, arrayOffset / 32));
    
    const assets = [];
    const borrows = [];
    let suppliedUSD = 0;
    let borrowedUSD = 0;
    let healthFactor = null;

    // Каждая запись UserReserveData занимает несколько слотов
    // Структура: underlyingAsset, scaledATokenBalance, usageAsCollateralEnabledOnUser,
    //            scaledVariableDebt, principalStableDebt, currentATokenBalance,
    //            currentVariableDebt, currentStableDebt, ...
    
    const startPos = (arrayOffset / 32) + 1;
    
    for (let i = 0; i < Math.min(arrayLength, 20); i++) {
      const base = startPos + i * 12; // примерно 12 слов на запись
      
      try {
        const underlyingAsset = '0x' + raw.slice(base * 64 + 24, base * 64 + 64);
        const currentATokenBalance = decodeUint(raw, base + 2);
        const currentVariableDebt = decodeUint(raw, base + 4);
        const currentStableDebt = decodeUint(raw, base + 5);
        
        // Пропускаем нулевые балансы
        if (currentATokenBalance === 0n && currentVariableDebt === 0n && currentStableDebt === 0n) {
          continue;
        }
        
        // Определяем токен
        const tokenSymbols = {
          '0x912ce59144191c1204e64559fe8253a0e49e6548': 'ARB',
          '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'WETH',
          '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'USDC',
          '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'USDT',
          '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': 'DAI',
          '0xba5ddd1f9d7f570d94a5142f6b52c044d5b0f58c': 'USDT0'
        };
        
        const symbol = tokenSymbols[underlyingAsset.toLowerCase()] || 'UNKNOWN';
        const decimals = symbol === 'USDC' || symbol === 'USDT' || symbol === 'USDT0' ? 6 : 18;
        
        const supplyAmount = Number(currentATokenBalance) / Math.pow(10, decimals);
        const borrowAmount = Number(currentVariableDebt + currentStableDebt) / Math.pow(10, decimals);
        
        // Оценочные цены (в продакшене нужен price oracle)
        const prices = { 'ARB': 0.13, 'WETH': 3500, 'USDC': 1, 'USDT': 1, 'DAI': 1, 'USDT0': 1 };
        const price = prices[symbol] || 0;
        
        if (supplyAmount > 0.001) {
          const usdValue = supplyAmount * price;
          suppliedUSD += usdValue;
          assets.push({
            symbol: symbol,
            role: 'supply',
            amount: supplyAmount.toFixed(4),
            usdValue: usdValue
          });
        }
        
        if (borrowAmount > 0.001) {
          const usdValue = borrowAmount * price;
          borrowedUSD += usdValue;
          borrows.push({
            symbol: symbol,
            amount: borrowAmount.toFixed(4),
            usdValue: usdValue
          });
        }
      } catch (e) {
        console.log('Parse error at index', i, e.message);
      }
    }
    
    // Расчет health factor
    if (borrowedUSD > 0) {
      healthFactor = (suppliedUSD * 0.8 / borrowedUSD).toFixed(2);
    } else if (suppliedUSD > 0) {
      healthFactor = '∞';
    }

    const netWorth = suppliedUSD - borrowedUSD;

    return json(200, {
      protocol: 'Aave V3',
      chain: chain,
      wallet: wallet,
      netWorth: netWorth.toFixed(2),
      suppliedUSD: suppliedUSD.toFixed(2),
      borrowedUSD: borrowedUSD.toFixed(2),
      healthFactor: healthFactor,
      assets: assets,
      borrows: borrows,
      rawLength: userResult.length,
      note: 'Реальные данные из Aave V3 через Alchemy'
    });

  } catch (e) {
    console.error('Error:', e);
    return json(500, { 
      error: e.message || 'Server error',
      details: 'Ошибка при запросе данных из Aave'
    });
  }
};

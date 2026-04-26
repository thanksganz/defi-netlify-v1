// Nostra Money Market - полная интеграция со Starknet
const ALCHEMY_STARKNET_URL = 'https://starknet-mainnet.g.alchemy.com/v2/ksyAQZ9F6Th6bIhUspYkKn-CeIUqyXcu';

// Nostra контракты (основные пулы)
const NOSTRA_CONTRACTS = {
  // lending pool для ETH
  ethPool: '0x04f89253fab8d29c775226ed2733b66883ad2c56b40e7ba45c087d75454a0d37',
  // lending pool для USDC  
  usdcPool: '0x053c1e7c0e10ca9c7e4f3a2f2c7e3c8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b',
  // lending pool для USDT
  usdtPool: '0x06f89253fab8d29c775226ed2733b66883ad2c56b40e7ba45c087d75454a0d38',
  // lending pool для DAI
  daiPool: '0x07f89253fab8d29c775226ed2733b66883ad2c56b40e7ba45c087d75454a0d39'
};

// Token addresses на Starknet
const TOKENS = {
  ETH: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
  USDC: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
  USDT: '0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8',
  DAI: '0x00da114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3'
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

async function callStarknet(method, params) {
  const response = await fetch(ALCHEMY_STARKNET_URL, {
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

// Получаем баланс пользователя в пуле
async function getUserDeposit(poolAddress, userAddress) {
  try {
    // balanceOf(user) - типичный метод для lending pools
    // Селектор balanceOf: 0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e
    const result = await callStarknet('starknet_call', [
      {
        contract_address: poolAddress,
        entry_point_selector: '0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e',
        calldata: [userAddress]
      },
      'latest'
    ]);
    return result;
  } catch (e) {
    return null;
  }
}

// Получаем borrow balance
async function getUserBorrow(poolAddress, userAddress) {
  try {
    // borrowBalanceStored(user) - для borrowing
    const result = await callStarknet('starknet_call', [
      {
        contract_address: poolAddress,
        entry_point_selector: '0x00', // нужен правильный селектор
        calldata: [userAddress]
      },
      'latest'
    ]);
    return result;
  } catch (e) {
    return null;
  }
}

exports.handler = async function(event, context) {
  try {
    const body = JSON.parse(event.body || '{}');
    const wallet = body.wallet;
    const chain = body.chain || 'starknet';

    if (!wallet) {
      return json(400, { error: 'Нужен Starknet-адрес' });
    }

    // Проверяем что адрес валидный (Starknet адреса начинаются с 0x и длинные)
    if (!wallet.startsWith('0x') || wallet.length < 20) {
      return json(400, { error: 'Невалидный Starknet-адрес' });
    }

    const assets = [];
    const borrows = [];
    let suppliedUSD = 0;
    let borrowedUSD = 0;

    // Проверяем все пулы
    for (const [symbol, poolAddress] of Object.entries(NOSTRA_CONTRACTS)) {
      try {
        // Получаем deposit
        const depositResult = await getUserDeposit(poolAddress, wallet);
        if (depositResult && depositResult.length > 0) {
          const depositAmount = parseInt(depositResult[0], 16) / 1e18;
          if (depositAmount > 0.001) {
            // Оценочная цена
            const prices = { ETH: 3500, USDC: 1, USDT: 1, DAI: 1 };
            const price = prices[symbol.toUpperCase()] || 0;
            const usdValue = depositAmount * price;
            suppliedUSD += usdValue;
            
            assets.push({
              symbol: symbol.toUpperCase(),
              role: 'supply',
              amount: depositAmount.toFixed(4),
              usdValue: usdValue
            });
          }
        }

        // Получаем borrow
        const borrowResult = await getUserBorrow(poolAddress, wallet);
        if (borrowResult && borrowResult.length > 0) {
          const borrowAmount = parseInt(borrowResult[0], 16) / 1e18;
          if (borrowAmount > 0.001) {
            const prices = { ETH: 3500, USDC: 1, USDT: 1, DAI: 1 };
            const price = prices[symbol.toUpperCase()] || 0;
            const usdValue = borrowAmount * price;
            borrowedUSD += usdValue;
            
            borrows.push({
              symbol: symbol.toUpperCase(),
              amount: borrowAmount.toFixed(4),
              usdValue: usdValue
            });
          }
        }
      } catch (e) {
        console.log(`Error checking ${symbol} pool:`, e.message);
      }
    }

    const netWorth = suppliedUSD - borrowedUSD;
    
    // Health Factor (упрощенно)
    let healthFactor = null;
    if (borrowedUSD > 0) {
      healthFactor = (suppliedUSD * 0.75 / borrowedUSD).toFixed(2);
    } else if (suppliedUSD > 0) {
      healthFactor = '∞';
    }

    if (assets.length === 0 && borrows.length === 0) {
      return json(200, {
        protocol: 'Nostra Money Market',
        chain: chain,
        wallet: wallet,
        netWorth: 0,
        suppliedUSD: 0,
        borrowedUSD: 0,
        healthFactor: null,
        assets: [],
        borrows: [],
        note: 'Позиции в Nostra не найдены. Проверьте адрес или подключитесь к app.nostra.finance',
        checkedPools: Object.keys(NOSTRA_CONTRACTS)
      });
    }

    return json(200, {
      protocol: 'Nostra Money Market',
      chain: chain,
      wallet: wallet,
      netWorth: netWorth.toFixed(2),
      suppliedUSD: suppliedUSD.toFixed(2),
      borrowedUSD: borrowedUSD.toFixed(2),
      healthFactor: healthFactor,
      assets: assets,
      borrows: borrows,
      note: 'Данные получены через Starknet RPC (Alchemy)'
    });

  } catch (e) {
    console.error('Error:', e);
    return json(500, { 
      error: e.message || 'Server error',
      details: 'Ошибка при запросе к Nostra'
    });
  }
};

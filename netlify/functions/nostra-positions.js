exports.handler = async (event) => {
  const { address } = event.queryStringParameters || {};
  
  if (!address) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Address required' })
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ protocol: 'Nostra', address, positions: [] })
  };
};

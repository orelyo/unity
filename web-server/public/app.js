(function () {
  const buyBtn = document.getElementById('buyBtn');
  const getAllUserBuysBtn = document.getElementById('getAllUserBuysBtn');
  const buyList = document.getElementById('buyList');
  const emptyMsg = document.getElementById('emptyMsg');
  const usernameInput = document.getElementById('username');
  const userIdInput = document.getElementById('userId');

  function getBaseUrl() {
    return window.location.origin;
  }

  buyBtn.addEventListener('click', async function () {
    const username = usernameInput.value.trim();
    const userId = userIdInput.value.trim();
    if (!username || !userId) {
      alert('Please enter Username and User ID');
      return;
    }
    buyBtn.disabled = true;
    try {
      const res = await fetch(getBaseUrl() + '/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Buy failed');
      alert('Purchase sent: price ' + data.price + ' at ' + (data.timestamp || 'now'));
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      buyBtn.disabled = false;
    }
  });

  function showPurchases(data) {
    const items = data.items || [];
    emptyMsg.style.display = items.length ? 'none' : 'block';
    emptyMsg.textContent = items.length ? '' : 'No purchases yet. Click "Buy", wait 2–3 seconds, then "getAllUserBuys" to refresh.';
    buyList.innerHTML = '';
    items.forEach(function (p) {
      const li = document.createElement('li');
      li.textContent = (p.username || '') + ' | ' + (p.price != null ? p.price : '') + ' | ' + (p.purchasedAt ? new Date(p.purchasedAt).toLocaleString() : '');
      buyList.appendChild(li);
    });
  }

  getAllUserBuysBtn.addEventListener('click', async function () {
    const userId = userIdInput.value.trim();
    if (!userId) {
      alert('Please enter User ID');
      return;
    }
    getAllUserBuysBtn.disabled = true;
    try {
      let res = await fetch(getBaseUrl() + '/getAllUserBuys?userId=' + encodeURIComponent(userId));
      let data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load purchases');
      if (!data.items || data.items.length === 0) {
        await new Promise(function (r) { setTimeout(r, 2500); });
        res = await fetch(getBaseUrl() + '/getAllUserBuys?userId=' + encodeURIComponent(userId));
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load purchases');
      }
      showPurchases(data);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      getAllUserBuysBtn.disabled = false;
    }
  });
})();

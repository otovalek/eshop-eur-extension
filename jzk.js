
const JZK_URL = 'http://jzk.cd.cz/everyone/jzk-osobni/index_cs.html'

function fetchJzk() {

 function fetchAndLog(url) {
  console.log("fetching "+url);
  return fetch(url);
 }

 let homeUrl = JZK_URL;
 return fetchAndLog(homeUrl)
  .then(response => response.text())
  .then(text => new DOMParser().parseFromString(text, "text/html"))
  .then(doc => {
   doc.head.insertBefore(doc.createElement("base"), doc.head.firstChild).setAttribute("href", homeUrl);
   let latestUrl = "";
   for (let link of doc.links)
    if (link.href.endsWith('.txt'))
     if (link.href > latestUrl)
      latestUrl = link.href;
   return fetchAndLog(latestUrl);
  })
  .then(response => response.text())
  .then(text => text.split('\n').find(line => line.startsWith('EUR')))
  .then(line => parseFloat(line.split('\t')[2]))
  .then(jzk => browser.storage.local.set({jzkValue: jzk, jzkUpdated: Date.now()}))
  .then(() => browser.storage.local.get(null))
  .then(storage => console.log("jzk set to "+storage.jzkValue))
  .catch(error => console.error(error));
}

async function getJzk() {
 let storage = await browser.storage.local.get(null);
 if (Date.now() > (storage.jzkUpdated ?? 0) + 24*3600*1000) {
  await browser.storage.local.remove(['jzkValue','jzkUpdated']);
  await fetchJzk();
  storage = await browser.storage.local.get(null);
 }
 return storage.jzkValue ?? 0;
}

function convert(czk, jzk) {
 return (parseInt(czk)/jzk).toFixed(1)+" \u20AC";
}

function queryAndProcess(selectors, callback) {
 document.querySelectorAll(selectors).forEach(el => {
  if (!el.classList.contains("processed")) {
   el.classList.add("processed");
   callback(el);
  }
 });
}

function process() {
 getJzk().then(jzk => {
  queryAndProcess(".rmenutop .rlinks", el => {
   let jzkBox = el.cloneNode(true);
   jzkBox.firstElementChild.innerText = "J\u017DK: 1 \u20AC = "+jzk+" K\u010D";
   jzkBox.firstElementChild.href = JZK_URL;
   el.after(jzkBox);
  });

  queryAndProcess(".buybut.green", el => {
   let czk = el.childNodes[4];
   czk.after(document.createElement("br"), document.createTextNode(convert(czk.textContent, jzk)));
  });

  queryAndProcess(".ticket .ptitle, .sh-ticketbox-modal .ptitle", el => {
   let euro = el.cloneNode(true);
   euro.innerText = convert(el.innerText, jzk);
   el.after(euro);
  });

  queryAndProcess(".dropdown-toggle.is-btn.is-btn-white.is-btn-xs", el => {
   el.removeAttribute('data-toggle');
   el.onclick = e => el.nextElementSibling.firstElementChild.firstElementChild.click();
  });
 });
}

process();

new MutationObserver((mutations, observer) => {
 let remain = observer.nextRun - performance.now();
 clearTimeout(observer.delayedTimer);
 let fun = () => {
  process();
  observer.nextRun = performance.now() + 100;
 }
 if (remain <= 0)
  fun();
 else
  observer.delayedTimer = setTimeout(fun, remain);
}).observe(document, { subtree: true, childList: true });

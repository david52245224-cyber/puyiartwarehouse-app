# 樸藝小倉庫預約管理

這個網頁用來查看和處理 Google 日曆「樸藝實體店預約」上的預約：確認、改時間、取消，以及複製要傳給客人的訊息。

網頁是 `index.html`，已經用 GitHub Pages 公開在：

https://david52245224-cyber.github.io/puyiartwarehouse-app/

日曆的後台在 Google Apps Script。後台程式目前不在這個倉庫裡，還在 Apps Script 編輯器中。`apps-script/` 是空的，這是故意的，避免用一份不完整的程式蓋掉線上版本。

## 現在怎麼更新

- **網頁**：`main` 分支上的 `index.html` 一更新，上面的網站會自己換成新版。不用再手動把檔案上傳到 GitHub。
- **後台**：在你做完下面的一次設定之前，GitHub 不會去改 Apps Script，現在的網址也不會變。設定完成之後，後台程式合併到 `main` 時會自動上傳，並更新現在這一組網址。

這次的自動更新沒有改預約畫面的功能。

## 你要做的一次設定

請用「擁有這個 Apps Script 專案」的 Google 帳號。專案在這裡：

https://script.google.com/home/projects/1mTRrRJZ2uDcna7PCTfeB95jXHlHidGwdnqsXucPw0poW6rL58R0Eg7mH/edit

### 1. 打開 Apps Script API

1. 打開 https://script.google.com/home/usersettings
2. 把 **Google Apps Script API** 打開。

### 2. 在自己的電腦登入，並把鑰匙放進 GitHub

1. 若電腦還沒有 Node.js，到 https://nodejs.org 安裝 LTS 版本。
2. 把這個倉庫下載到電腦並進入資料夾（GitHub Desktop 或 `git clone` 都可以）。
3. 在這個資料夾打開終端機，執行：

   ```bash
   npx --yes @google/clasp@3.4.1 login
   ```

   瀏覽器會要求登入。請選擁有這個腳本的 Google 帳號，並按允許。
4. 登入後，家目錄會出現一個隱藏檔 `.clasprc.json`。
   - Mac：`/Users/你的名字/.clasprc.json`
   - Windows：`C:\Users\你的名字\.clasprc.json`
5. 用記事本打開它，從第一個 `{` 到最後一個 `}` 全部複製。
6. 打開 GitHub 這個倉庫 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**。
   - Name 填：`CLASPRC_JSON`
   - Secret 貼上剛剛複製的整份內容，然後儲存。

這份檔案等於後台的鑰匙。只放在 GitHub 的 Secrets。不要把它上傳到倉庫，也不要貼到聊天或郵件裡。

### 3. 把線上正在跑的後台程式下載進來

這個倉庫已經有 `.clasp.json`，裡面寫好了腳本編號，所以請用 `pull` 下載。

在倉庫資料夾執行：

```bash
npx --yes @google/clasp@3.4.1 pull
```

檔案會出現在 `apps-script/`，通常是 `Code.gs` 和 `appsscript.json`。請確認下載到的是線上現有程式，不要改用網頁「連線設定」裡那段備份文字來代替。

`clasp clone` 是同一件事的第一次下載指令。這個倉庫已經有 `.clasp.json`，直接 clone 會停下來並顯示 `Project file already exists`。那是正常的，請改執行上面的 `pull`。

如果是在一個還沒有 `.clasp.json` 的新資料夾，才用：

```bash
npx --yes @google/clasp@3.4.1 clone "1mTRrRJZ2uDcna7PCTfeB95jXHlHidGwdnqsXucPw0poW6rL58R0Eg7mH" --rootDir apps-script
```

下載後看一下 `apps-script/appsscript.json`。如果裡面有 `webapp`，請維持原來的 `access` 和 `executeAs`，不要改成別的值。那兩項決定客人現在的網址誰可以連。

然後把下載下來的程式放上 GitHub。先確認清單裡沒有 `.clasprc.json`：

```bash
git status
git add apps-script
git commit -m "把線上的後台程式放進倉庫"
git push
```

### 4. 核對部署編號，確認網址不會換

網頁現在連去的編號，已經寫在 `.github/gas-deployment-id.txt`。它是從網頁網址 `/macros/s/` 和 `/exec` 中間那段取出來的。

請再對一次：

1. 打開上面的 Apps Script 專案。
2. 右上角 **部署** → **管理部署**。
3. 找到類型是網頁應用程式、網址和現在網站所用相同的那一筆。
4. 複製它的部署 ID。

它應該和 `.github/gas-deployment-id.txt` 裡的內容相同。若相同，不用再做什麼。

若不同，到 GitHub Secrets 再新增一個：

- Name：`GAS_DEPLOYMENT_ID`
- Secret：剛剛複製的部署 ID

不要填清單裡標成 **HEAD** 的編號。自動更新只會更新這一筆現有部署，不會新建一組網址。

也可以在終端機執行 `npx --yes @google/clasp@3.4.1 deployments` 來看同一份清單。

### 5. 確認 Actions 有打開

打開倉庫的 **Actions** 分頁。如果 GitHub 請你啟用，就按啟用。

密鑰貼好、後台程式也推上 `main` 之後，可以在 Actions 裡選「更新預約後台（網址不變）」，按 **Run workflow**。或是直接再推一次 `main`。

第一次跑完後，打開預約網頁，按一次「讀取日曆」，確認還看得到行程。

## 之後每次改程式

1. 改 `index.html`（網頁）或 `apps-script/`（後台）。
2. 合併或推上 `main`。
3. 網頁會自己更新。後台會由 Actions 上傳，並沿用現在的網址。

後台改完之後，請改這個倉庫裡的檔案。若又到 Apps Script 編輯器裡手動改，下一次自動更新會用倉庫裡的版本蓋過編輯器。

在 `apps-script/` 還沒有 `Code.gs` 和 `appsscript.json` 之前，Actions 會跳過後台更新，不會去動線上程式。

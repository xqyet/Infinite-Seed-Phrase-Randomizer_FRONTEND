document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("checkWallet").addEventListener("click", async () => {
        try {
            if (typeof window.ethereum === 'undefined') {
                alert('MetaMask is not installed');
                return;
            }

            const accounts = await ethereum.request({ method: 'eth_accounts' });

            let metaMaskAddress;

            if (accounts.length === 0) {
                try {
                    await ethereum.request({ method: 'eth_requestAccounts' });
                    metaMaskAddress = (await ethereum.request({ method: 'eth_accounts' }))[0];
                } catch (accessError) {
                    console.error("MetaMask access error:", accessError.message);
                    document.getElementById("output").textContent = `Error: ${accessError.message}. Please approve MetaMask connection.`;
                    return;
                }
            } else {
                metaMaskAddress = accounts[0];
            }

            const web3 = new Web3(window.ethereum);

            // Fetch all seed phrases from the API
            const response = await fetch("http://localhost:5233/api/SeedPhrase/All");
            if (!response.ok) {
                throw new Error("Error fetching seed phrases: " + response.statusText);
            }

            const seedPhrases = await response.json();

            document.getElementById("output").innerHTML = "";

            const chunkSize = 10;
            for (let i = 0; i < seedPhrases.length; i += chunkSize) {
                const seedPhraseChunk = seedPhrases.slice(i, i + chunkSize);

                const checkingPromises = seedPhraseChunk.map(async (seedPhrase) => {
                    let phraseElement = document.createElement("p");
                    phraseElement.textContent = `Checking seed phrase: ${seedPhrase}`;
                    document.getElementById("output").appendChild(phraseElement);

                    try {
                        // Strict mnemonic validation using ethers.js
                        if (!ethers.utils.isValidMnemonic(seedPhrase)) {
                            phraseElement.textContent = `Invalid mnemonic: ${seedPhrase}, skipping...`;
                            return false;
                        }

                        const wallet = ethers.Wallet.fromMnemonic(seedPhrase);
                        const derivedAddress = wallet.address;

                        // Checking ETH and Binance Smart Chain balance with web3.js
                        const ethBalance = await web3.eth.getBalance(derivedAddress);
                        if (parseInt(ethBalance) > 0) {
                            phraseElement.textContent = `Match found! Seed phrase: ${seedPhrase} (ETH/BSC balance: ${web3.utils.fromWei(ethBalance, 'ether')} ETH)`;

                            // Save the match to a JSON file
                            saveSeedPhraseToFile(seedPhrase, derivedAddress, 'ETH/BSC', web3.utils.fromWei(ethBalance, 'ether'));
                            return true;
                        } else {
                            phraseElement.textContent = `Checked: ${seedPhrase} (No ETH/BSC balance)`;
                        }

                        // Checking Solana balance using solana/web3.js
                        const solanaConnection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'));
                        const solanaBalance = await solanaConnection.getBalance(new solanaWeb3.PublicKey(derivedAddress));
                        if (solanaBalance > 0) {
                            phraseElement.textContent = `Match found! Seed phrase: ${seedPhrase} (SOL balance: ${solanaBalance / solanaWeb3.LAMPORTS_PER_SOL} SOL)`;

                            // Save the match to a JSON file
                            saveSeedPhraseToFile(seedPhrase, derivedAddress, 'SOL', solanaBalance / solanaWeb3.LAMPORTS_PER_SOL);
                            return true;
                        } else {
                            phraseElement.textContent = `Checked: ${seedPhrase} (No SOL balance)`;
                        }

                        // Checking Bitcoin balance using an external API (Blockstream)
                        const bitcoinAddress = bitcoinjs.payments.p2pkh({ pubkey: wallet.publicKey }).address;
                        const bitcoinResponse = await fetch(`https://blockstream.info/api/address/${bitcoinAddress}`);
                        const bitcoinData = await bitcoinResponse.json();
                        const bitcoinBalance = bitcoinData.chain_stats.funded_txo_sum - bitcoinData.chain_stats.spent_txo_sum;
                        if (bitcoinBalance > 0) {
                            phraseElement.textContent = `Match found! Seed phrase: ${seedPhrase} (BTC balance: ${bitcoinBalance / 1e8} BTC)`;

                            // Save the match to a JSON file
                            saveSeedPhraseToFile(seedPhrase, bitcoinAddress, 'BTC', bitcoinBalance / 1e8);
                            return true;
                        } else {
                            phraseElement.textContent = `Checked: ${seedPhrase} (No BTC balance)`;
                        }

                        return false;
                    } catch (mnemonicError) {
                        phraseElement.textContent = `Error processing mnemonic: ${seedPhrase}, skipping...`;
                        return false;
                    }
                });

                const results = await Promise.all(checkingPromises);

                if (results.includes(true)) {
                    break;
                }
            }

            document.getElementById("output").appendChild(document.createElement("hr"));
            let finishedElement = document.createElement("p");
            finishedElement.textContent = "Finished checking all seed phrases.";
            document.getElementById("output").appendChild(finishedElement);

        } catch (error) {
            console.error("Error:", error);
            document.getElementById("output").textContent = `Error: ${error.message}`;
        }
    });

    // Function to save seed phrase and details to a JSON file
    function saveSeedPhraseToFile(seedPhrase, address, chain, balance) {
        const data = {
            seedPhrase: seedPhrase,
            address: address,
            chain: chain,
            balance: balance
        };

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Create a link element to trigger the file download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'seed_phrase_match.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});

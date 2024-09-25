document.addEventListener("DOMContentLoaded", () => {
    // Ensure that the element exists before accessing its properties
    const outputElement = document.getElementById("output");
    const noValidElement = document.querySelector(".no-valid-found");

    if (!outputElement || !noValidElement) {
        console.error("Required elements not found in the DOM.");
        return;
    }

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
                    outputElement.textContent = `Error: ${accessError.message}. Please approve MetaMask connection.`;
                    return;
                }
            } else {
                metaMaskAddress = accounts[0];
            }

            const web3 = new Web3(window.ethereum);
            const chunkSize = 400; // Number of seed phrases to fetch at a time
            let isFinished = false; // Controls when to stop the loop

            outputElement.innerHTML = "";  // Clear the output

            // Continuously fetch and check seed phrases
            while (true) {
                const response = await fetch(`http://localhost:5233/api/SeedPhrase/Random/${chunkSize}`);
                if (!response.ok) {
                    throw new Error("Error fetching seed phrases: " + response.statusText);
                }

                const seedPhrases = await response.json();

                // Process each seed phrase
                for (const seedPhrase of seedPhrases) {
                    let phraseElement = document.createElement("p");
                    phraseElement.classList.add("seed-phrase");
                    phraseElement.textContent = `Checking seed phrase: ${seedPhrase}`;
                    outputElement.appendChild(phraseElement);

                    try {
                        // Strict mnemonic validation using ethers.js
                        if (!ethers.utils.isValidMnemonic(seedPhrase)) {
                            phraseElement.textContent = `Invalid mnemonic: ${seedPhrase}, skipping...`;
                            phraseElement.classList.add("invalid-mnemonic");
                            continue;
                        }

                        const wallet = ethers.Wallet.fromMnemonic(seedPhrase);
                        const derivedAddress = wallet.address;

                        // Checking ETH and Binance Smart Chain balance with web3.js
                        const ethBalance = await web3.eth.getBalance(derivedAddress);
                        if (parseInt(ethBalance) > 0) {
                            phraseElement.textContent = `Match found! Seed phrase: ${seedPhrase} (ETH/BSC balance: ${web3.utils.fromWei(ethBalance, 'ether')} ETH)`;
                            phraseElement.classList.add("match-found");

                            // Update the "[ No valid seed-phrase found ]" message to green and change text
                            noValidElement.textContent = "[ Seed-phrase found ]";
                            noValidElement.style.color = "green";

                            // Save the match to a JSON file
                            saveSeedPhraseToFile(seedPhrase, derivedAddress, 'ETH/BSC', web3.utils.fromWei(ethBalance, 'ether'));
                            isFinished = true; // Stop the loop when a match is found
                            break;
                        } else {
                            phraseElement.textContent = `Checked: ${seedPhrase} (No ETH/BSC balance)`;
                            phraseElement.classList.add("checked");
                        }

                        // Add any other chain checks like Solana or Bitcoin here if necessary

                    } catch (mnemonicError) {
                        phraseElement.textContent = `Error processing mnemonic: ${seedPhrase}, skipping...`;
                        phraseElement.classList.add("invalid-mnemonic");
                    }
                }

                // If a match is found, stop the continuous generation
                if (isFinished) {
                    break;
                }
            }

        } catch (error) {
            console.error("Error:", error);
            outputElement.textContent = `Error: ${error.message}`;
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

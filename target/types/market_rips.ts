/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/market_rips.json`.
 */
export type MarketRips = {
  "address": "Fu7hq2ZxsxDfmTFvMN6kxaZa6z5uB1ENKiH4Af2HwkbL",
  "metadata": {
    "name": "marketRips",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Inventory-backed stock pack opening on Solana with MagicBlock"
  },
  "instructions": [
    {
      "name": "addPrizeEntry",
      "discriminator": [
        85,
        136,
        20,
        52,
        232,
        49,
        155,
        61
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "platform"
          ]
        },
        {
          "name": "platform",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          },
          "relations": [
            "pack"
          ]
        },
        {
          "name": "pack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "pack.packId",
                "account": "packConfig"
              }
            ]
          }
        },
        {
          "name": "stockMint"
        },
        {
          "name": "authorityStockAccount",
          "writable": true
        },
        {
          "name": "prizeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "pack"
              },
              {
                "kind": "account",
                "path": "stockTokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "stockTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "rawAmountPerPull",
          "type": "u64"
        },
        {
          "name": "units",
          "type": "u32"
        }
      ]
    },
    {
      "name": "buyPack",
      "discriminator": [
        151,
        46,
        141,
        93,
        174,
        5,
        49,
        173
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "platform",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          },
          "relations": [
            "pack"
          ]
        },
        {
          "name": "pack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "pack.packId",
                "account": "packConfig"
              }
            ]
          }
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "buyerPaymentAccount",
          "writable": true
        },
        {
          "name": "paymentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "paymentTokenProgram"
        },
        {
          "name": "purchase",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  114,
                  99,
                  104,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "packSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "purchase"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimPrize",
      "discriminator": [
        157,
        233,
        139,
        121,
        246,
        62,
        234,
        235
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "buyer",
          "relations": [
            "packSession"
          ]
        },
        {
          "name": "platform",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          },
          "relations": [
            "pack"
          ]
        },
        {
          "name": "pack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "pack.packId",
                "account": "packConfig"
              }
            ]
          },
          "relations": [
            "purchase"
          ]
        },
        {
          "name": "purchase",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  114,
                  99,
                  104,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "purchase.buyer",
                "account": "purchase"
              },
              {
                "kind": "account",
                "path": "purchase.nonce",
                "account": "purchase"
              }
            ]
          },
          "relations": [
            "packSession"
          ]
        },
        {
          "name": "packSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "purchase"
              }
            ]
          }
        },
        {
          "name": "stockMint"
        },
        {
          "name": "prizeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "pack"
              },
              {
                "kind": "account",
                "path": "stockTokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "buyerStockAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "account",
                "path": "stockTokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "stockTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "slot",
          "type": "u8"
        }
      ]
    },
    {
      "name": "commitPackSession",
      "docs": [
        "Commits an intermediate reveal state from the ER back to Solana."
      ],
      "discriminator": [
        46,
        179,
        19,
        134,
        104,
        150,
        153,
        174
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "packSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "packSession.purchase",
                "account": "packSession"
              }
            ]
          }
        },
        {
          "name": "sessionToken",
          "optional": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "consumePackRandomness",
      "docs": [
        "MagicBlock VRF callback. The `#[vrf_callback]` account macro validates",
        "the scoped VRF identity before this handler can run."
      ],
      "discriminator": [
        59,
        212,
        39,
        89,
        78,
        158,
        23,
        123
      ],
      "accounts": [
        {
          "name": "vrfProgramIdentity",
          "docs": [
            "Scoped VRF identity PDA, bound to this program. Its presence as a signer proves",
            "the callback was issued by the VRF program for this program."
          ],
          "signer": true
        },
        {
          "name": "pack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "pack.platform",
                "account": "packConfig"
              },
              {
                "kind": "account",
                "path": "pack.packId",
                "account": "packConfig"
              }
            ]
          },
          "relations": [
            "purchase"
          ]
        },
        {
          "name": "purchase",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  114,
                  99,
                  104,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "purchase.buyer",
                "account": "purchase"
              },
              {
                "kind": "account",
                "path": "purchase.nonce",
                "account": "purchase"
              }
            ]
          },
          "relations": [
            "packSession"
          ]
        },
        {
          "name": "packSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "purchase"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "randomness",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createPack",
      "discriminator": [
        44,
        61,
        245,
        51,
        98,
        247,
        57,
        174
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "platform"
          ]
        },
        {
          "name": "platform",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "pack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "arg",
                "path": "packId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "packId",
          "type": "u64"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "revealTimeoutSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "delegatePackSession",
      "docs": [
        "Delegates only the per-purchase reveal state. Shared inventory, token",
        "vaults, payments and settlement always remain on Solana L1."
      ],
      "discriminator": [
        45,
        238,
        221,
        4,
        84,
        245,
        225,
        19
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferPackSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "packSession"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                221,
                93,
                102,
                50,
                6,
                201,
                35,
                204,
                17,
                163,
                170,
                56,
                65,
                90,
                204,
                255,
                128,
                252,
                255,
                167,
                236,
                107,
                228,
                52,
                225,
                17,
                130,
                116,
                55,
                124,
                186,
                227
              ]
            }
          }
        },
        {
          "name": "delegationRecordPackSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "packSession"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPackSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "packSession"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "packSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "purchase"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "Fu7hq2ZxsxDfmTFvMN6kxaZa6z5uB1ENKiH4Af2HwkbL"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "purchase",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializePlatform",
      "discriminator": [
        119,
        201,
        101,
        45,
        75,
        122,
        89,
        3
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "platform",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "paymentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "paymentTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "baseAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62
              ]
            }
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "refundExpired",
      "discriminator": [
        118,
        153,
        164,
        244,
        40,
        128,
        242,
        250
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "buyer",
          "docs": [
            "required because the refund destination is also constrained to this key."
          ],
          "relations": [
            "purchase",
            "packSession"
          ]
        },
        {
          "name": "platform",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          },
          "relations": [
            "pack"
          ]
        },
        {
          "name": "pack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "pack.packId",
                "account": "packConfig"
              }
            ]
          },
          "relations": [
            "purchase"
          ]
        },
        {
          "name": "purchase",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  114,
                  99,
                  104,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "purchase.buyer",
                "account": "purchase"
              },
              {
                "kind": "account",
                "path": "purchase.nonce",
                "account": "purchase"
              }
            ]
          },
          "relations": [
            "packSession"
          ]
        },
        {
          "name": "packSession",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "purchase"
              }
            ]
          }
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "paymentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "buyerPaymentAccount",
          "writable": true
        },
        {
          "name": "paymentTokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "requestPackRandomness",
      "docs": [
        "Requests MagicBlock VRF on Solana L1. The callback also executes on L1,",
        "where it can safely reserve shared stock inventory before the per-user",
        "reveal session is delegated to an Ephemeral Rollup."
      ],
      "discriminator": [
        205,
        23,
        249,
        140,
        35,
        231,
        211,
        113
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true,
          "relations": [
            "purchase",
            "packSession"
          ]
        },
        {
          "name": "pack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "pack.platform",
                "account": "packConfig"
              },
              {
                "kind": "account",
                "path": "pack.packId",
                "account": "packConfig"
              }
            ]
          },
          "relations": [
            "purchase"
          ]
        },
        {
          "name": "purchase",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  114,
                  99,
                  104,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "account",
                "path": "purchase.nonce",
                "account": "purchase"
              }
            ]
          },
          "relations": [
            "packSession"
          ]
        },
        {
          "name": "packSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "purchase"
              }
            ]
          }
        },
        {
          "name": "oracleQueue",
          "writable": true,
          "address": "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "vrfProgram",
          "address": "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "clientSeed",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "restockPrizeEntry",
      "discriminator": [
        92,
        112,
        152,
        87,
        146,
        61,
        8,
        98
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "platform"
          ]
        },
        {
          "name": "platform",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          },
          "relations": [
            "pack"
          ]
        },
        {
          "name": "pack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "pack.packId",
                "account": "packConfig"
              }
            ]
          }
        },
        {
          "name": "stockMint"
        },
        {
          "name": "authorityStockAccount",
          "writable": true
        },
        {
          "name": "prizeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "pack"
              },
              {
                "kind": "account",
                "path": "stockTokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "stockTokenProgram"
        }
      ],
      "args": [
        {
          "name": "entryIndex",
          "type": "u8"
        },
        {
          "name": "units",
          "type": "u32"
        }
      ]
    },
    {
      "name": "revealCard",
      "docs": [
        "Executes on the Ephemeral Rollup. A wallet may sign directly, or a",
        "bounded SessionTokenV2 may authorize the temporary session signer."
      ],
      "discriminator": [
        152,
        230,
        28,
        32,
        204,
        156,
        215,
        35
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "packSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "packSession.purchase",
                "account": "packSession"
              }
            ]
          }
        },
        {
          "name": "sessionToken",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "slot",
          "type": "u8"
        }
      ]
    },
    {
      "name": "setPackEnabled",
      "discriminator": [
        69,
        189,
        52,
        145,
        6,
        53,
        174,
        186
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "platform"
          ]
        },
        {
          "name": "platform",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          },
          "relations": [
            "pack"
          ]
        },
        {
          "name": "pack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "pack.packId",
                "account": "packConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "enabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "undelegatePackSession",
      "docs": [
        "Final reveal step: commit state and return PackSession ownership to this",
        "program on L1. Prize claims are valid only after this completes."
      ],
      "discriminator": [
        34,
        202,
        63,
        243,
        137,
        64,
        47,
        120
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "packSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "packSession.purchase",
                "account": "packSession"
              }
            ]
          }
        },
        {
          "name": "sessionToken",
          "optional": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "updatePlatform",
      "discriminator": [
        46,
        78,
        138,
        189,
        47,
        163,
        120,
        85
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "platform"
          ]
        },
        {
          "name": "platform",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "feeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "paused",
          "type": {
            "option": "bool"
          }
        }
      ]
    },
    {
      "name": "withdrawProceeds",
      "discriminator": [
        124,
        68,
        215,
        12,
        201,
        136,
        54,
        72
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "platform"
          ]
        },
        {
          "name": "platform",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "paymentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "platform"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "authorityPaymentAccount",
          "writable": true
        },
        {
          "name": "paymentTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "packConfig",
      "discriminator": [
        124,
        1,
        129,
        61,
        25,
        216,
        84,
        173
      ]
    },
    {
      "name": "packSession",
      "discriminator": [
        80,
        94,
        75,
        2,
        168,
        201,
        129,
        44
      ]
    },
    {
      "name": "platformConfig",
      "discriminator": [
        160,
        78,
        128,
        0,
        248,
        83,
        230,
        160
      ]
    },
    {
      "name": "purchase",
      "discriminator": [
        33,
        203,
        1,
        252,
        231,
        228,
        8,
        67
      ]
    }
  ],
  "events": [
    {
      "name": "cardRevealed",
      "discriminator": [
        252,
        80,
        147,
        240,
        129,
        145,
        231,
        208
      ]
    },
    {
      "name": "packCreated",
      "discriminator": [
        92,
        171,
        154,
        76,
        191,
        36,
        54,
        31
      ]
    },
    {
      "name": "packPurchased",
      "discriminator": [
        82,
        119,
        203,
        221,
        29,
        83,
        38,
        79
      ]
    },
    {
      "name": "platformInitialized",
      "discriminator": [
        16,
        222,
        212,
        5,
        213,
        140,
        112,
        162
      ]
    },
    {
      "name": "prizeClaimed",
      "discriminator": [
        213,
        150,
        192,
        76,
        199,
        33,
        212,
        38
      ]
    },
    {
      "name": "prizeEntryAdded",
      "discriminator": [
        57,
        58,
        81,
        107,
        251,
        78,
        158,
        76
      ]
    },
    {
      "name": "purchaseRefunded",
      "discriminator": [
        181,
        111,
        228,
        8,
        192,
        68,
        247,
        37
      ]
    },
    {
      "name": "randomnessFulfilled",
      "discriminator": [
        61,
        67,
        128,
        142,
        15,
        77,
        223,
        252
      ]
    },
    {
      "name": "randomnessRequested",
      "discriminator": [
        10,
        64,
        183,
        29,
        104,
        63,
        90,
        149
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "feeTooHigh",
      "msg": "The configured fee is too high"
    },
    {
      "code": 6001,
      "name": "invalidAuthority",
      "msg": "The authority is invalid"
    },
    {
      "code": 6002,
      "name": "invalidPrice",
      "msg": "The pack price must be greater than zero"
    },
    {
      "code": 6003,
      "name": "invalidRevealTimeout",
      "msg": "The reveal timeout must be at least 60 seconds"
    },
    {
      "code": 6004,
      "name": "invalidPrizeAmount",
      "msg": "The prize amount must be greater than zero"
    },
    {
      "code": 6005,
      "name": "invalidInventoryAmount",
      "msg": "The inventory amount must be greater than zero"
    },
    {
      "code": 6006,
      "name": "disablePackBeforeEditing",
      "msg": "Disable the pack before editing its prize table"
    },
    {
      "code": 6007,
      "name": "tooManyPrizeEntries",
      "msg": "The pack already has the maximum number of prize entries"
    },
    {
      "code": 6008,
      "name": "duplicatePrizeMint",
      "msg": "The prize mint is already configured for this pack"
    },
    {
      "code": 6009,
      "name": "arithmeticOverflow",
      "msg": "An arithmetic operation overflowed"
    },
    {
      "code": 6010,
      "name": "notEnoughPrizeEntries",
      "msg": "At least three prize entries are required"
    },
    {
      "code": 6011,
      "name": "insufficientInventory",
      "msg": "The pack does not have enough unreserved inventory"
    },
    {
      "code": 6012,
      "name": "platformPaused",
      "msg": "The platform is paused"
    },
    {
      "code": 6013,
      "name": "packDisabled",
      "msg": "The pack is disabled"
    },
    {
      "code": 6014,
      "name": "invalidPrizeEntry",
      "msg": "The prize entry index is invalid"
    },
    {
      "code": 6015,
      "name": "prizeEntryDisabled",
      "msg": "The prize entry is disabled"
    },
    {
      "code": 6016,
      "name": "invalidPrizeMint",
      "msg": "The supplied prize mint does not match the selected entry"
    },
    {
      "code": 6017,
      "name": "invalidTokenProgram",
      "msg": "The supplied token program does not match the selected entry"
    },
    {
      "code": 6018,
      "name": "invalidCardSlot",
      "msg": "The card slot is invalid"
    },
    {
      "code": 6019,
      "name": "resultNotReady",
      "msg": "The VRF result is not ready"
    },
    {
      "code": 6020,
      "name": "revealNotComplete",
      "msg": "All cards must be revealed before claiming"
    },
    {
      "code": 6021,
      "name": "prizeAlreadyClaimed",
      "msg": "This prize was already claimed"
    },
    {
      "code": 6022,
      "name": "reservationMissing",
      "msg": "The selected prize does not have a reservation"
    },
    {
      "code": 6023,
      "name": "purchaseNotRefundable",
      "msg": "This purchase cannot be refunded"
    },
    {
      "code": 6024,
      "name": "purchaseNotExpired",
      "msg": "This purchase has not expired"
    },
    {
      "code": 6025,
      "name": "paymentVaultInsolvent",
      "msg": "The payment vault cannot cover locked purchases"
    },
    {
      "code": 6026,
      "name": "withdrawalExceedsProceeds",
      "msg": "The withdrawal exceeds unlocked proceeds"
    },
    {
      "code": 6027,
      "name": "invalidPurchaseStatus",
      "msg": "The purchase is not in the required state"
    },
    {
      "code": 6028,
      "name": "randomnessAlreadyFulfilled",
      "msg": "Randomness was already fulfilled for this purchase"
    },
    {
      "code": 6029,
      "name": "invalidPurchase",
      "msg": "The purchase account does not match the reveal session"
    },
    {
      "code": 6030,
      "name": "unauthorized",
      "msg": "The signer is not authorized for this reveal session"
    },
    {
      "code": 6031,
      "name": "cardAlreadyRevealed",
      "msg": "This card was already revealed"
    },
    {
      "code": 6032,
      "name": "pendingDrawInvariant",
      "msg": "The pending draw counter is inconsistent"
    },
    {
      "code": 6033,
      "name": "randomSelectionFailed",
      "msg": "A prize could not be selected from the available inventory"
    }
  ],
  "types": [
    {
      "name": "cardRevealed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "purchase",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u8"
          },
          {
            "name": "entryIndex",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "packConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "platform",
            "type": "pubkey"
          },
          {
            "name": "packId",
            "type": "u64"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "revealTimeoutSeconds",
            "type": "i64"
          },
          {
            "name": "entryCount",
            "type": "u8"
          },
          {
            "name": "pendingDraws",
            "type": "u32"
          },
          {
            "name": "enabled",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "entries",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "prizeDefinition"
                  }
                },
                8
              ]
            }
          }
        ]
      }
    },
    {
      "name": "packCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pack",
            "type": "pubkey"
          },
          {
            "name": "packId",
            "type": "u64"
          },
          {
            "name": "price",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "packPurchased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "purchase",
            "type": "pubkey"
          },
          {
            "name": "pack",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "packSession",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "purchase",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "selectedEntries",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "revealedMask",
            "type": "u8"
          },
          {
            "name": "claimedMask",
            "type": "u8"
          },
          {
            "name": "vrfFulfilled",
            "type": "bool"
          },
          {
            "name": "completed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "platformConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "paymentMint",
            "type": "pubkey"
          },
          {
            "name": "paymentTokenProgram",
            "type": "pubkey"
          },
          {
            "name": "lockedPayments",
            "type": "u64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "platformInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "platform",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "paymentMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "prizeClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "purchase",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u8"
          },
          {
            "name": "entryIndex",
            "type": "u8"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "prizeDefinition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "tokenProgram",
            "type": "pubkey"
          },
          {
            "name": "rawAmountPerPull",
            "type": "u64"
          },
          {
            "name": "availableUnits",
            "type": "u32"
          },
          {
            "name": "reservedUnits",
            "type": "u32"
          },
          {
            "name": "claimedUnits",
            "type": "u32"
          },
          {
            "name": "enabled",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "prizeEntryAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pack",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "units",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "purchase",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "pack",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "amountPaid",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "purchaseStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "purchaseRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "purchase",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "purchaseStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "paid"
          },
          {
            "name": "randomnessPending"
          },
          {
            "name": "resultReady"
          },
          {
            "name": "settled"
          },
          {
            "name": "refunded"
          }
        ]
      }
    },
    {
      "name": "randomnessFulfilled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "purchase",
            "type": "pubkey"
          },
          {
            "name": "selectedEntries",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          }
        ]
      }
    },
    {
      "name": "randomnessRequested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "purchase",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "sessionTokenV2",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "targetProgram",
            "type": "pubkey"
          },
          {
            "name": "sessionSigner",
            "type": "pubkey"
          },
          {
            "name": "feePayer",
            "type": "pubkey"
          },
          {
            "name": "validUntil",
            "type": "i64"
          }
        ]
      }
    }
  ]
};

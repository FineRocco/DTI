package intol.dti;

import java.util.TreeMap;

import bftsmart.tom.MessageContext;
import bftsmart.tom.ServiceReplica;
import bftsmart.tom.server.defaultservices.DefaultSingleRecoverable;
import intol.bftmap.BFTMapServer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

public class DTIServer<K, V> extends DefaultSingleRecoverable {
    private final Logger logger = LoggerFactory.getLogger("bftsmart");
    private TreeMap<K, V> replicaMapCoins; //coinID -> coinValue
    private TreeMap<K, List<V>> replicaMapOwners; //ownerID -> list of coinIDs


        //The constructor passes the id of the server to the super class
    public DTIServer(int id) {
        replicaMapCoins = new TreeMap<>();
        replicaMapOwners = new TreeMap<>();

        //turn-on BFT-SMaRt'replica
        new ServiceReplica(id, this, this);
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            System.out.println("Use: java DTIServer <server id>");
            System.exit(-1);
        }
        new DTIServer<Integer, String>(Integer.parseInt(args[0]));
    }

    @Override
    public void installSnapshot(byte[] state) {
        try (ByteArrayInputStream bis = new ByteArrayInputStream(state);
             ObjectInput in = new ObjectInputStream(bis)) {
            replicaMapCoins = (TreeMap<K, V>) in.readObject();
            replicaMapOwners = (TreeMap<K, List<V>>) in.readObject();
        } catch (ClassNotFoundException | IOException ex) {
            ex.printStackTrace(); //debug instruction
        }
    }

    @Override
    public byte[] getSnapshot() {
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream();
             ObjectOutput out = new ObjectOutputStream(bos)) {
            out.writeObject(replicaMapCoins);
            out.writeObject(replicaMapOwners);
            out.flush();
            bos.flush();
            return bos.toByteArray();
        } catch (IOException ex) {
            ex.printStackTrace(); //debug instruction
            return new byte[0];
        }
    }

    @Override
    public byte[] appExecuteOrdered(byte[] command, MessageContext msgCtx) {
        //all operations must be defined here to be invoked by BFT-SMaRt
        try{
            DTIMessage<K,V> response = new DTIMessage<>();
            DTIMessage<K,V> request = DTIMessage.fromBytes(command);
            DTIRequestType cmd = request.getType();

            logger.info("Ordered execution of a {} request from {}", cmd, msgCtx.getSender());

            switch (cmd) {
                case MY_COINS:
                    //Get the list of coins owned by the sender
                    List<V> coins = replicaMapOwners.get((K) Integer.valueOf(msgCtx.getSender()));
                    Map<K, V> coinValues = new HashMap<>();

                    //Get the values of the coins
                    if (coins != null) {
                        for (V coinId : coins) {
                            K coinIdAsK = (K) coinId;
                            V coinValue = replicaMapCoins.get(coinIdAsK);
                            if (coinValue != null) {
                                coinValues.put(coinIdAsK, coinValue);
                            }
                        }
                        //Return the list of coins
                        response.setMap(coinValues);
                    }else{
                        logger.error("No coins minted by user");
                    }
                    return DTIMessage.toBytes(response);
                case MINT:
                    // Generate a new unique ID for the coin
                    int newId = 0;
                    if (!replicaMapCoins.isEmpty() && replicaMapCoins.lastKey() instanceof Integer) {
                        newId = (Integer)replicaMapCoins.lastKey() + 1;
                    }
                    //Add the new coin to the map
                    replicaMapCoins.put((K) Integer.valueOf(newId), request.getValue());

                    //Check if the owner has a list of coins and create if not
                    List<V> coinsList = replicaMapOwners.get((K) Integer.valueOf(msgCtx.getSender()));
                    if (coinsList == null) {
                        coinsList = new ArrayList<>();
                    }

                    //Add the new coin to the owner's list
                    coinsList.add((V) Integer.valueOf(newId));
                    replicaMapOwners.put((K) Integer.valueOf(msgCtx.getSender()), coinsList);

                    //Return the new coin ID
                    System.out.println("Minted coin with ID: " + newId);
                    response.setId((K) Integer.valueOf(newId));
                    return DTIMessage.toBytes(response);
                case SPEND:
                    //Get the list of coins owned by the sender
                    List<K> coinsListSender = request.getKeyList();
                    if (coinsListSender == null) {
                        logger.error("User has no coins to spend");
                        response.setUserId(-1);
                        return DTIMessage.toBytes(response);
                    }

                    //Get the list of coins owned by the sender
                    List<V> coinsListSenderValues = replicaMapOwners.get((K) Integer.valueOf(msgCtx.getSender()));
                    if (coinsListSenderValues == null) {
                        logger.error("User does not exist");
                        response.setUserId(-1);
                        return DTIMessage.toBytes(response);
                    }
                    // Convert the list of coins to the same type as the one in the map
                    List<K> coinsListSenderServer = new ArrayList<>();
                    for (V coinId : coinsListSenderValues) {
                        coinsListSenderServer.add((K) coinId);
                    }
                    // Check if all the coins the sender wants to spend are in their possession
                    for (K coinId : coinsListSender) {
                        if (!coinsListSenderServer.contains(coinId)) {
                            logger.error("User does not have coin with ID: " + coinId);
                            response.setUserId(-1);
                            return DTIMessage.toBytes(response);
                        }
                    }
                    //Check if the sender is trying to send coins to himself
                    if (request.getUserId() == msgCtx.getSender()) {
                        logger.error("User is trying to send coins to himself");
                        response.setUserId(-1);
                        return DTIMessage.toBytes(response);
                    }                   
                    
                    //Check if the receiver exists
                    if (replicaMapOwners.get(request.getUserId()) == null) {
                        logger.error("Receiver does not exist");
                        response.setUserId(-1);
                        return DTIMessage.toBytes(response);
                    }

                    // Parse the total value of the coins owned by the sender
                    float totalValue = 0.0f;
                    for (K coinId : coinsListSender) {
                        Object coinObj = replicaMapCoins.get(coinId);
                        float coinValue = 0.0f;
                        if (coinObj instanceof String) {
                            coinValue = Float.parseFloat((String) coinObj);
                        } else if (coinObj instanceof Number) {
                            coinValue = ((Number) coinObj).floatValue();
                        } else {
                            logger.error("Unexpected coin value type for coin ID " + coinId);
                        }
                        totalValue += coinValue;
                    }

                    // Similarly, parse the spending value from the request
                    Object reqValueObj = request.getValue();
                    float reqValue = 0.0f;
                    if (reqValueObj instanceof String) {
                        reqValue = Float.parseFloat((String) reqValueObj);
                    } else if (reqValueObj instanceof Number) {
                        reqValue = ((Number) reqValueObj).floatValue();
                    } else {
                        logger.error("Unexpected request value type: " + reqValueObj);
                    }

                    // Check if the sender has enough value to spend
                    if (totalValue < reqValue) {
                        logger.error("User does not have enough value to spend");
                        response.setUserId(-1);
                        return DTIMessage.toBytes(response);
                    }

                    // Convert request value to an integer
                    int spendingValue;
                    if (reqValueObj instanceof String) {
                        spendingValue = Integer.parseInt((String) reqValueObj);
                    } else if (reqValueObj instanceof Number) {
                        spendingValue = ((Number) reqValueObj).intValue();
                    } else {
                        logger.error("Unexpected type for request value: " + reqValueObj);
                        response.setUserId(-1);
                        return DTIMessage.toBytes(response);
                    }

                    // Check if total value of coins is greater or equal than the value to be spent
                    if (totalValue >= spendingValue) {
                        // Remove the coins from the sender
                        for (K coinId : request.getKeyList()) {
                            replicaMapCoins.remove(coinId);
                            coinsListSenderServer.remove(coinId);
                        }
                        // Check if the total value is equal
                        if (totalValue == spendingValue) {
                            response.setUserId(0);
                            replicaMapOwners.put((K) Integer.valueOf(msgCtx.getSender()), (List<V>) coinsListSenderServer);
                        } else {
                            // Create a coin with the remaining value
                            newId = 0;
                            if (!replicaMapCoins.isEmpty() && replicaMapCoins.lastKey() instanceof Integer) {
                                newId = (Integer) replicaMapCoins.lastKey() + 1;
                            }
                            coinsListSenderServer.add((K) Integer.valueOf(newId));
                            float remainingValue = totalValue - spendingValue;
                            // Convert remaining value to a String if necessary
                            replicaMapCoins.put((K) Integer.valueOf(newId), (V) Float.toString(remainingValue));
                            // Add the remaining coin to the sender
                            replicaMapOwners.put((K) Integer.valueOf(msgCtx.getSender()), (List<V>) coinsListSenderServer);
                            response.setUserId(newId);
                        }
                    }

                    //Add the coins to the receiver
                    List<V> coinsListReceiverValues = replicaMapOwners.get(request.getUserId());
                    if (coinsListReceiverValues == null) {
                        coinsListReceiverValues = new ArrayList<>();
                    }
                    newId = 0;
                    if (!replicaMapCoins.isEmpty() && replicaMapCoins.lastKey() instanceof Integer) {
                        newId = (Integer) replicaMapCoins.lastKey() + 1;
                    }
                    // Convert the list of coins to the same type as the one in the map
                    List<K> coinsListReceiverConverted = new ArrayList<>();
                    for (V coinId : coinsListReceiverValues) {
                        coinsListReceiverConverted.add((K) coinId);
                    }
                    //Add the new coin to the receiver
                    coinsListReceiverConverted.add((K) Integer.valueOf(newId));

                    // Safely convert request.getValue() to a String value.
                    reqValueObj = request.getValue();
                    String reqValueStr;
                    if (reqValueObj instanceof String) {
                        reqValueStr = (String) reqValueObj;
                    } else if (reqValueObj instanceof Number) {
                        reqValueStr = reqValueObj.toString();
                    } else {
                        logger.error("Unexpected type for request value: " + reqValueObj);
                        reqValueStr = "";
                    }

                    replicaMapCoins.put((K) Integer.valueOf(newId), (V) reqValueStr);
                    replicaMapOwners.put((K) Integer.valueOf(request.getUserId()), (List<V>) coinsListReceiverConverted);

                    return DTIMessage.toBytes(response);
            }
            return null;
        } catch (IOException | ClassNotFoundException ex) {
            logger.error("Failed to execute request");
            return new byte[0];
        }
    }

    @Override
    public byte[] appExecuteUnordered(byte[] command, MessageContext msgCtx) {
                //all operations must be defined here to be invoked by BFT-SMaRt
                try{
                    DTIMessage<K,V> response = new DTIMessage<>();
                    DTIMessage<K,V> request = DTIMessage.fromBytes(command);
                    DTIRequestType cmd = request.getType();
        
                    logger.info("Ordered execution of a {} request from {}", cmd, msgCtx.getSender());
        
                    switch (cmd) {
                        case MY_COINS:
                            //Get the list of coins owned by the sender
                            List<V> coins = replicaMapOwners.get((K) Integer.valueOf(msgCtx.getSender()));
                            Map<K, V> coinValues = new HashMap<>();
        
                            //Get the values of the coins
                            if (coins != null) {
                                for (V coinId : coins) {
                                    K coinIdAsK = (K) coinId;
                                    V coinValue = replicaMapCoins.get(coinIdAsK);
                                    if (coinValue != null) {
                                        coinValues.put(coinIdAsK, coinValue);
                                    }
                                }
                                //Return the list of coins
                                response.setMap(coinValues);
                            }else{
                                logger.error("No coins minted by user");
                            }
                            return DTIMessage.toBytes(response);
                    }
                    return null;
                } catch (IOException | ClassNotFoundException ex) {
                    logger.error("Failed to execute request");
                    return new byte[0];
                }
    }
}

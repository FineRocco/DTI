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
                        //If the owner has no coins, return an empty list
                        coins= new ArrayList<>();
                        replicaMapOwners.put((K) Integer.valueOf(msgCtx.getSender()), coins);
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
                    //TODO
            }
            return null;
        } catch (IOException | ClassNotFoundException ex) {
            logger.error("Failed to execute request");
            return new byte[0];
        }
    }

    @Override
    public byte[] appExecuteUnordered(byte[] command, MessageContext msgCtx) {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'appExecuteUnordered'");
    }
}

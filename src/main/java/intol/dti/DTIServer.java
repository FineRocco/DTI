package intol.dti;

import java.util.TreeMap;

import bftsmart.tom.MessageContext;
import bftsmart.tom.ServiceReplica;
import bftsmart.tom.server.defaultservices.DefaultSingleRecoverable;
import intol.bftmap.BFTMapServer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
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
                    List<V> coins = replicaMapOwners.get(msgCtx.getSender());
                    Map<K, V> coinValues = new HashMap<>();
                    if (coins != null) {
                        for (V coinId : coins) {
                            K coinIdAsK = (K) coinId;
                            V coinValue = replicaMapCoins.get(coinIdAsK);
                            if (coinValue != null) {
                                coinValues.put(coinIdAsK, coinValue);
                            }
                        }
                        response.setMap(coinValues);
                    }
                    return DTIMessage.toBytes(response);
                case MINT:
                    //TODO
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

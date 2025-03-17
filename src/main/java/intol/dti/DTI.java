package intol.dti;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import bftsmart.tom.ServiceProxy;

public class DTI<K, V> {
    private final Logger logger = LoggerFactory.getLogger("bftsmart");
    private final ServiceProxy serviceProxy;

    public DTI(int id) {
        serviceProxy = new ServiceProxy(id);
    }

    public Map<K,V> getCoins() {
        byte[] rep;
        try{
            DTIMessage<K,V> request = new DTIMessage<>();
            request.setType(DTIRequestType.MY_COINS);

            //invokes BFT-SMaRt
            rep = serviceProxy.invokeUnordered(DTIMessage.toBytes(request));
        } catch (Exception e) {
            logger.error("Failed to send MY_COINS request");
            return null;
        }

        if(rep.length == 0){
            return null;
        }
        try{
            DTIMessage<K,V> response = DTIMessage.fromBytes(rep);
            return response.getMap();
        } catch (Exception e) {
            logger.error("Failed to deserialize response of MY_COINS request");
            return null;
        }
    }

    public Integer mint(Float value) {
        byte[] rep;
        try{
            DTIMessage<K,V> request = new DTIMessage<>();
            request.setType(DTIRequestType.MINT);
            // Convert float to string to match the generic type V
            request.setValue((V) value.toString());

            //invokes BFT-SMaRt
            rep = serviceProxy.invokeOrdered(DTIMessage.toBytes(request));
        } catch (Exception e) {
            logger.error("Failed to send MINT request");
            return -1;
        }

        if(rep.length == 0){
            return -1;
        }
        try{
            DTIMessage<K,V> response = DTIMessage.fromBytes(rep);
            return (Integer) response.getId();
        } catch (Exception e) {
            logger.error("Failed to deserialize response of MINT request");
            return -1;
        }
    }

    public Integer spend(List<Integer> coinIDs, int receiverId, int value) {
        byte[] rep;
        try{
            DTIMessage<K,V> request = new DTIMessage<>();
            request.setType(DTIRequestType.SPEND);
            // Convert float to string to match the generic type V
            request.setKeyList((List<K>)coinIDs);
            request.setUserId(receiverId);
            request.setValue((V) Integer.valueOf(value));

            //invokes BFT-SMaRt
            rep = serviceProxy.invokeOrdered(DTIMessage.toBytes(request));
        } catch (Exception e) {
            logger.error("Failed to send MINT request");
            return -1;
        }

        if(rep.length == 0){
            return -1;
        }
        try{
            DTIMessage<K,V> response = DTIMessage.fromBytes(rep);
            return (Integer) response.getUserId();
        } catch (Exception e) {
            logger.error("Failed to deserialize response of MINT request");
            return -1;
        }
    }

}

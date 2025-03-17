package intol.dti;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.util.List;
import java.util.Map;

public class DTIMessage<K,V> implements Serializable {
    private DTIRequestType type;
    private K id;
    private V value;
    private int userId;
    private Map<K,V> map;
    private List<K> keyList;
    
    private int size;


    public DTIMessage() {
    }

    public static <K,V>byte[] toBytes(DTIMessage<K,V> message) throws IOException {
        ByteArrayOutputStream byteOut = new ByteArrayOutputStream();
        ObjectOutputStream objOut = new ObjectOutputStream(byteOut);
        objOut.writeObject(message);

        objOut.flush();
        byteOut.flush();

        return byteOut.toByteArray();
        }

        @SuppressWarnings("unchecked")
        public static <K,V> DTIMessage<K,V> fromBytes(byte[] rep) throws IOException, ClassNotFoundException {
        ByteArrayInputStream byteIn = new ByteArrayInputStream(rep);
        ObjectInputStream objIn = new ObjectInputStream(byteIn);
        return (DTIMessage<K,V>) objIn.readObject();
        }

        public DTIRequestType getType() {
        return type;
        }

        public void setType(DTIRequestType type) {
        this.type = type;
        }

        public K getId() {
        return id;
        }

        public void setId(K id) {
        this.id = id;
        }

        public V getValue() {
        return value;
        }

        public void setValue(V value) {
        this.value = value;
        }

        public int getSize() {
        return size;
        }

        public void setSize(int size) {
        this.size = size;
        }

        public int getUserId() {
            return userId;
        }

        public void setUserId(int userId) {
            this.userId = userId;
        }

        public Map<K,V> getMap() {
            return map;
        }

        public void setMap(Map<K,V> map) {
            this.map = map;
        }

        public List<K> getKeyList() {
            return keyList;
        }

        public void setKeyList(List<K> keyList) {
            this.keyList = keyList;
        }
}


